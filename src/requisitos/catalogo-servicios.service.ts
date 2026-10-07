import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { readFile } from 'fs/promises';
import { ServicioCatalogo } from './servicio-catalogo.entity.js';
import { RequisitoPlantilla } from './requisito-plantilla.entity.js';
import { Expediente } from '../expedientes/expediente.entity.js';
import { MateriaJuridica } from '../common/enums/index.js';

interface ReqJson {
  id: string; orden: number; nombre: string; tipo: string; categoria: string | null;
  aporta: string; obligatorio: boolean; condicion: string | null; validar: boolean; nota: string | null;
}
interface CatalogoJson {
  version: string;
  perfilPreguntas: Record<string, string>;
  generales: (ReqJson & { id: string })[];
  areas: {
    area: string; materia: string;
    servicios: {
      id: string; nombre: string; materia: string; baseLegal: { texto: string; estado: string }[];
      competencia: string | null; etapas: string[]; preguntas: string[]; requisitos: ReqJson[];
    }[];
  }[];
}

const normalizar = (t: string) =>
  t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

@Injectable()
export class CatalogoServiciosService implements OnModuleInit {
  private readonly logger = new Logger(CatalogoServiciosService.name);
  private preguntas: Record<string, string> = {};

  constructor(
    @InjectRepository(ServicioCatalogo) private readonly servicioRepo: Repository<ServicioCatalogo>,
    @InjectRepository(RequisitoPlantilla) private readonly plantillaRepo: Repository<RequisitoPlantilla>,
    @InjectRepository(Expediente) private readonly expedienteRepo: Repository<Expediente>,
  ) {}

  /** Si el catálogo aún no se ha cargado, lo carga (idempotente). Nunca impide arrancar la app. */
  async onModuleInit(): Promise<void> {
    try {
      if ((await this.servicioRepo.count()) === 0) await this.cargar();
    } catch (e) {
      this.logger.warn(`No se pudo cargar el catálogo al iniciar: ${(e as Error).message}`);
    }
  }

  private async leerJson(): Promise<CatalogoJson> {
    const url = new URL('./catalogo/catalogo-requisitos-jaym.json', import.meta.url);
    return JSON.parse(await readFile(url, 'utf8')) as CatalogoJson;
  }

  /**
   * Carga/actualiza el catálogo desde el JSON versionado. Idempotente: upsert
   * por código. Un requisito ya aprobado por el abogado conserva su
   * aprobación (validar=false) aunque se vuelva a cargar el archivo.
   */
  async cargar(): Promise<{ servicios: number; requisitos: number; generales: number }> {
    const cat = await this.leerJson();
    this.preguntas = cat.perfilPreguntas;
    let servicios = 0, requisitos = 0;

    const upsertReq = async (r: ReqJson, extra: Partial<RequisitoPlantilla>) => {
      const existente = await this.plantillaRepo.findOne({ where: { codigo: r.id } });
      const aprobado = !!existente?.aprobadoEn;
      const datos: Partial<RequisitoPlantilla> = {
        codigo: r.id,
        nombreRequisito: r.nombre,
        descripcion: r.nota ?? undefined,
        obligatorio: r.obligatorio,
        orden: r.orden,
        tipo: r.tipo,
        categoriaDocumento: r.categoria,
        aporta: r.aporta,
        condicion: r.condicion,
        validar: aprobado ? false : r.validar,
        nota: r.nota,
        ...extra,
      };
      if (existente) await this.plantillaRepo.update(existente.id, datos as any);
      else await this.plantillaRepo.save(this.plantillaRepo.create({ ...datos, activo: true } as any));
      requisitos++;
    };

    for (const g of cat.generales) {
      await upsertReq(g, { general: true, servicioCodigo: null, materia: MateriaJuridica.OTRA });
    }

    for (const area of cat.areas) {
      for (const s of area.servicios) {
        const datos = {
          codigo: s.id, area: area.area, materia: s.materia as MateriaJuridica, nombre: s.nombre,
          baseLegal: s.baseLegal, competencia: s.competencia, etapas: s.etapas, preguntas: s.preguntas,
        };
        const ex = await this.servicioRepo.findOne({ where: { codigo: s.id } });
        if (ex) await this.servicioRepo.update(ex.id, { ...datos, version: ex.version + 1 } as any);
        else await this.servicioRepo.save(this.servicioRepo.create({ ...datos, activo: true }));
        servicios++;
        for (const r of s.requisitos) {
          await upsertReq(r, { general: false, servicioCodigo: s.id, materia: s.materia as MateriaJuridica });
        }
      }
    }
    return { servicios, requisitos, generales: cat.generales.length };
  }

  async preguntasPerfil(): Promise<Record<string, string>> {
    if (!Object.keys(this.preguntas).length) this.preguntas = (await this.leerJson()).perfilPreguntas;
    return this.preguntas;
  }

  /** Árbol Área → Servicios para el formulario de creación de expediente. */
  async listarArbol() {
    const servicios = await this.servicioRepo.find({ where: { activo: true }, order: { area: 'ASC', nombre: 'ASC' } });
    const preguntas = await this.preguntasPerfil();
    const porArea = new Map<string, { area: string; materia: string; servicios: unknown[] }>();
    for (const s of servicios) {
      if (!porArea.has(s.area)) porArea.set(s.area, { area: s.area, materia: s.materia, servicios: [] });
      porArea.get(s.area)!.servicios.push({
        codigo: s.codigo, nombre: s.nombre, materia: s.materia, baseLegal: s.baseLegal,
        competencia: s.competencia, etapas: s.etapas,
        preguntas: s.preguntas.map((k) => ({ clave: k, texto: preguntas[k] ?? k })),
      });
    }
    return [...porArea.values()];
  }

  async obtener(codigo: string): Promise<ServicioCatalogo | null> {
    return this.servicioRepo.findOne({ where: { codigo, activo: true } });
  }

  /** Requisitos que aplican a un servicio según el perfil: generales + del servicio con condición cumplida. */
  async requisitosAplicables(codigo: string, perfil: Record<string, boolean>): Promise<RequisitoPlantilla[]> {
    const todos = await this.plantillaRepo.find({
      where: [
        { general: true, activo: true },
        { servicioCodigo: codigo, activo: true },
      ],
      order: { orden: 'ASC' },
    });
    return todos.filter((r) => !r.condicion || perfil?.[r.condicion] === true);
  }

  /** Lista de requisitos y bases legales «por validar», para la pantalla de aprobación. */
  async pendientesDeValidar() {
    const requisitos = await this.plantillaRepo.find({ where: { validar: true, activo: true }, order: { servicioCodigo: 'ASC', orden: 'ASC' } });
    const servicios = (await this.servicioRepo.find()).filter((s) => s.baseLegal.some((b) => b.estado !== 'verificada'));
    return { requisitos, serviciosConBaseLegalPorValidar: servicios.map((s) => ({ codigo: s.codigo, nombre: s.nombre, baseLegal: s.baseLegal })) };
  }

  async aprobar(codigos: string[] | undefined, usuarioId: string): Promise<{ aprobados: number }> {
    const where = codigos?.length ? { codigo: In(codigos), validar: true } : { validar: true };
    const res = await this.plantillaRepo.update(where as any, { validar: false, aprobadoEn: new Date(), aprobadoPorId: usuarioId });
    return { aprobados: res.affected ?? 0 };
  }

  /**
   * Vista previa (dry-run) para expedientes existentes: propone un servicio
   * por coincidencia con `tipoServicio` y NO modifica nada.
   */
  async propuestaParaExistentes() {
    const servicios = await this.servicioRepo.find({ where: { activo: true } });
    const expedientes = await this.expedienteRepo.find({ where: { servicioCodigo: IsNull() } });
    return expedientes.map((e) => {
      const t = normalizar(e.tipoServicio ?? '');
      const candidatos = t
        ? servicios.filter((s) => s.materia === e.materia && (normalizar(s.nombre).includes(t) || t.includes(normalizar(s.nombre))))
        : [];
      return {
        expedienteId: e.id, codigo: e.codigo, materia: e.materia, tipoServicio: e.tipoServicio ?? null,
        propuesta: candidatos.length === 1 ? { codigo: candidatos[0].codigo, nombre: candidatos[0].nombre } : null,
        candidatos: candidatos.length > 1 ? candidatos.map((c) => ({ codigo: c.codigo, nombre: c.nombre })) : [],
      };
    });
  }
}
