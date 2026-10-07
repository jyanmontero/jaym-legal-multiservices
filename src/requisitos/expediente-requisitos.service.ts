import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { CatalogoServiciosService } from './catalogo-servicios.service.js';
import { ExpedienteRequisito } from './expediente-requisito.entity.js';
import { RequisitosPlantillaService } from './requisitos-plantilla.service.js';
import { CrearRequisitoManualDto, ActualizarRequisitoDto } from './dto/requisito.dto.js';
import { MateriaJuridica, EstadoRequisito } from '../common/enums/index.js';

export interface ProgresoExpediente {
  porcentaje: number;
  totalObligatorios: number;
  completadosObligatorios: number;
  pendientesObligatorios: ExpedienteRequisito[];
}

@Injectable()
export class ExpedienteRequisitosService {
  constructor(
    @InjectRepository(ExpedienteRequisito)
    private readonly requisitoRepo: Repository<ExpedienteRequisito>,
    private readonly plantillaService: RequisitosPlantillaService,
    private readonly catalogoService: CatalogoServiciosService,
  ) {}

  /**
   * Copia las plantillas activas de la materia al abrir un expediente —
   * sección 8. Se llama automáticamente desde ExpedientesService.crear().
   */
  async generarDesdeMateria(expedienteId: string, materia: MateriaJuridica): Promise<void> {
    // Sin perfil no se pueden evaluar condiciones: solo los requisitos siempre aplicables.
    const plantillas = (await this.plantillaService.listarPorMateria(materia)).filter((p) => !p.condicion);
    if (plantillas.length === 0) return;

    const requisitos = plantillas.map((p) =>
      this.requisitoRepo.create({
        expedienteId,
        requisitoPlantillaId: p.id,
        nombreRequisito: p.nombreRequisito,
        descripcion: p.descripcion,
        obligatorio: p.obligatorio,
        orden: p.orden,
        estado: EstadoRequisito.PENDIENTE,
        origen: 'materia',
        plantillaCodigo: p.codigo,
        tipo: p.tipo,
        categoriaDocumento: p.categoriaDocumento,
        aporta: p.aporta,
        validar: p.validar,
      }),
    );

    await this.requisitoRepo.save(requisitos);
  }

  /**
   * Garantiza que un expediente SIN servicio del catálogo tenga en su
   * checklist los requisitos base de su materia (también los expedientes
   * creados antes de existir la biblioteca por materia). Solo agrega lo que
   * falta; nunca borra ni modifica nada existente.
   */
  async asegurarRequisitosDeMateria(expedienteId: string, materia: MateriaJuridica): Promise<number> {
    const plantillas = (await this.plantillaService.listarPorMateria(materia)).filter((p) => !p.condicion);
    if (plantillas.length === 0) return 0;
    const existentes = await this.requisitoRepo.find({ where: { expedienteId } });
    const ids = new Set(existentes.map((e) => e.requisitoPlantillaId).filter(Boolean));
    const codigos = new Set(existentes.map((e) => e.plantillaCodigo).filter(Boolean));
    const nombres = new Set(existentes.map((e) => e.nombreRequisito.trim().toLowerCase()));
    const faltantes = plantillas.filter(
      (p) => !ids.has(p.id) && !(p.codigo && codigos.has(p.codigo)) && !nombres.has(p.nombreRequisito.trim().toLowerCase()),
    );
    if (faltantes.length === 0) return 0;
    await this.requisitoRepo.save(
      faltantes.map((p) =>
        this.requisitoRepo.create({
          expedienteId, requisitoPlantillaId: p.id, nombreRequisito: p.nombreRequisito,
          descripcion: p.nota ?? p.descripcion, obligatorio: p.obligatorio, orden: p.orden,
          estado: EstadoRequisito.PENDIENTE, origen: 'materia', plantillaCodigo: p.codigo,
          tipo: p.tipo, categoriaDocumento: p.categoriaDocumento, aporta: p.aporta, validar: p.validar,
        }),
      ),
    );
    return faltantes.length;
  }

  /**
   * Genera o sincroniza el checklist de un expediente a partir de su servicio
   * del catálogo y su perfil (generales + requisitos del servicio cuya
   * condición se cumpla). Reglas al cambiar servicio/perfil:
   *  - se agrega lo que falta;
   *  - NUNCA se borra nada ni se toca un requisito ya completado;
   *  - lo que dejó de aplicar se marca no_aplica con motivo automático;
   *  - lo marcado no_aplica automáticamente que vuelve a aplicar se reabre;
   *  - los requisitos manuales y los no_aplica decididos por una persona no se tocan.
   */
  async sincronizarConServicio(
    expedienteId: string,
    servicioCodigo: string,
    perfil: Record<string, boolean>,
    manager?: EntityManager,
  ): Promise<{ agregados: number; marcadosNoAplica: number; reabiertos: number }> {
    const repo = manager ? manager.getRepository(ExpedienteRequisito) : this.requisitoRepo;
    const deseados = await this.catalogoService.requisitosAplicables(servicioCodigo, perfil);
    const existentes = await repo.find({ where: { expedienteId } });
    const porCodigo = new Map(existentes.filter((e) => e.plantillaCodigo).map((e) => [e.plantillaCodigo!, e]));
    const codigosDeseados = new Set(deseados.map((d) => d.codigo!));
    const AUTO = 'Auto:';
    let agregados = 0, marcadosNoAplica = 0, reabiertos = 0;

    for (const d of deseados) {
      const ya = porCodigo.get(d.codigo!);
      if (!ya) {
        await repo.save(repo.create({
          expedienteId, requisitoPlantillaId: d.id, plantillaCodigo: d.codigo, nombreRequisito: d.nombreRequisito,
          descripcion: d.nota ?? d.descripcion, obligatorio: d.obligatorio, orden: d.orden,
          estado: EstadoRequisito.PENDIENTE, origen: d.general ? 'general' : 'servicio',
          tipo: d.tipo, categoriaDocumento: d.categoriaDocumento, aporta: d.aporta, validar: d.validar,
        }));
        agregados++;
      } else if (ya.estado === EstadoRequisito.NO_APLICA && ya.motivoNoAplica?.startsWith(AUTO)) {
        await repo.update(ya.id, { estado: EstadoRequisito.PENDIENTE, motivoNoAplica: null } as any);
        reabiertos++;
      }
    }

    for (const e of existentes) {
      if (!e.plantillaCodigo || e.origen === 'manual' || e.origen === 'materia') continue;
      if (codigosDeseados.has(e.plantillaCodigo)) continue;
      if (e.estado === EstadoRequisito.COMPLETO || e.estado === EstadoRequisito.NO_APLICA) continue;
      await repo.update(e.id, {
        estado: EstadoRequisito.NO_APLICA,
        motivoNoAplica: `${AUTO} dejó de aplicar al cambiar el servicio o el perfil del expediente`,
      } as any);
      marcadosNoAplica++;
    }
    return { agregados, marcadosNoAplica, reabiertos };
  }

  async agregarManual(
    expedienteId: string,
    dto: CrearRequisitoManualDto,
  ): Promise<ExpedienteRequisito> {
    const requisito = this.requisitoRepo.create({
      expedienteId,
      nombreRequisito: dto.nombreRequisito,
      descripcion: dto.descripcion,
      obligatorio: dto.obligatorio ?? true,
      fechaPrometida: dto.fechaPrometida,
      responsableId: dto.responsableId,
      estado: EstadoRequisito.PENDIENTE,
      origen: 'manual',
      // requisitoPlantillaId queda nulo: es un requisito único de este caso.
    });
    return this.requisitoRepo.save(requisito);
  }

  async listarPorExpediente(expedienteId: string): Promise<ExpedienteRequisito[]> {
    return this.requisitoRepo.find({
      where: { expedienteId },
      order: { orden: 'ASC', creadoEn: 'ASC' },
    });
  }

  async obtenerPorId(id: string): Promise<ExpedienteRequisito> {
    const requisito = await this.requisitoRepo.findOne({ where: { id } });
    if (!requisito) throw new NotFoundException('Requisito no encontrado');
    return requisito;
  }

  async actualizar(id: string, dto: ActualizarRequisitoDto): Promise<ExpedienteRequisito> {
    const requisito = await this.obtenerPorId(id);

    if (dto.estado === EstadoRequisito.NO_APLICA && !dto.motivoNoAplica?.trim()) {
      throw new BadRequestException('Para marcar un requisito como «no aplica» debe indicar el motivo.');
    }
    if (dto.estado && dto.estado !== EstadoRequisito.NO_APLICA) {
      // Al salir de «no aplica» se limpia el motivo (update con null explícito: ver nota abajo).
      await this.requisitoRepo.update(id, { motivoNoAplica: null } as any);
    }

    Object.assign(requisito, dto);

    // Si se marca como completo, se registra la fecha automáticamente
    // (a menos que el estado se esté revirtiendo, en cuyo caso se limpia).
    // IMPORTANTE: .save() ignora campos `undefined` (no genera SET = NULL),
    // como se descubrió al probar el módulo de Documentos — por eso aquí se
    // usa .update() con `null` explícito para el caso de limpiar la fecha.
    if (dto.estado === EstadoRequisito.COMPLETO) {
      requisito.fechaCompletado = new Date().toISOString().slice(0, 10);
      await this.requisitoRepo.save(requisito);
    } else if (dto.estado) {
      await this.requisitoRepo.save(requisito);
      await this.requisitoRepo.update(id, { fechaCompletado: null } as any);
    } else {
      await this.requisitoRepo.save(requisito);
    }

    return this.obtenerPorId(id);
  }

  /**
   * Progreso calculado al vuelo — nunca se almacena (sección 8):
   * (obligatorios completos o no_aplica) / (total de obligatorios) × 100.
   */
  async calcularProgreso(expedienteId: string): Promise<ProgresoExpediente> {
    const requisitos = await this.listarPorExpediente(expedienteId);
    const obligatorios = requisitos.filter((r) => r.obligatorio);

    const completados = obligatorios.filter(
      (r) => r.estado === EstadoRequisito.COMPLETO || r.estado === EstadoRequisito.NO_APLICA,
    );

    const pendientes = obligatorios.filter(
      (r) => r.estado !== EstadoRequisito.COMPLETO && r.estado !== EstadoRequisito.NO_APLICA,
    );

    const porcentaje =
      obligatorios.length === 0 ? 100 : Math.round((completados.length / obligatorios.length) * 100);

    return {
      porcentaje,
      totalObligatorios: obligatorios.length,
      completadosObligatorios: completados.length,
      pendientesObligatorios: pendientes,
    };
  }

  /**
   * Advertencia (no bloqueo) al intentar marcar un expediente como
   * "listo para depositar" con requisitos obligatorios pendientes —
   * sección 8: "mostrar advertencia... la decisión final es del abogado".
   */
  async obtenerAdvertenciaDeposito(expedienteId: string): Promise<{
    tieneRequisitosPendientes: boolean;
    pendientes: ExpedienteRequisito[];
  }> {
    const progreso = await this.calcularProgreso(expedienteId);
    return {
      tieneRequisitosPendientes: progreso.pendientesObligatorios.length > 0,
      pendientes: progreso.pendientesObligatorios,
    };
  }
}
