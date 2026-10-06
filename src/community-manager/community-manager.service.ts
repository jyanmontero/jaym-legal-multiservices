import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AlmacenamientoService } from '../documentos/almacenamiento.service.js';
import { BlogService } from '../blog/blog.service.js';
import { FICHA_MARCA, INFO_REDES, REDES, type RedSocial } from './ficha-marca.js';
import {
  PublicacionRedes,
  type EstadoPublicacionRedes,
  type ResultadoRed,
} from './publicacion-redes.entity.js';
import { RedaccionRedesService } from './redaccion-redes.service.js';
import { MetaLegalPublisher } from './publicadores/meta-legal.publisher.js';
import { LinkedinPublisher } from './publicadores/linkedin.publisher.js';
import { ThreadsPublisher } from './publicadores/threads.publisher.js';
import type {
  ActualizarPublicacionDto,
  CrearPublicacionDto,
  GenerarPublicacionDto,
  SugerirSemanaDto,
} from './dto/community-manager.dto.js';

// Límites duros de cada red (los de INFO_REDES son recomendaciones de lectura).
const LIMITE_DURO: Record<RedSocial, number> = {
  facebook: 5000,
  instagram: 2200,
  linkedin: 3000,
  threads: 500,
  x: 280,
  tiktok: 2200,
  youtube: 5000,
  google_business: 1500,
};

const AHORA = () => new Date().toISOString();

function textoPlano(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Community Manager de JAYM Legal. Propone publicaciones adaptadas a cada
 * red, espera la aprobación de Joseph y las publica (o las deja listas para
 * copiar en las redes sin conexión automática). Nada se publica sin que
 * Joseph apruebe explícitamente (aprobarYProgramar / aprobarYPublicar).
 */
@Injectable()
export class CommunityManagerService {
  private readonly logger = new Logger(CommunityManagerService.name);

  constructor(
    @InjectRepository(PublicacionRedes)
    private readonly repo: Repository<PublicacionRedes>,
    private readonly almacenamiento: AlmacenamientoService,
    private readonly redaccion: RedaccionRedesService,
    private readonly meta: MetaLegalPublisher,
    private readonly linkedin: LinkedinPublisher,
    private readonly threads: ThreadsPublisher,
    private readonly blogService: BlogService,
  ) {}

  // --- Conexiones y ficha -------------------------------------------------

  private conectada(red: RedSocial): boolean {
    switch (red) {
      case 'facebook':
        return this.meta.facebookConfigurado();
      case 'instagram':
        return this.meta.instagramConfigurado();
      case 'linkedin':
        return this.linkedin.configurado();
      case 'threads':
        return this.threads.configurado();
      default:
        return false;
    }
  }

  conexiones(): Record<RedSocial, { nombre: string; automatica: boolean; conectada: boolean }> {
    const salida = {} as Record<RedSocial, { nombre: string; automatica: boolean; conectada: boolean }>;
    for (const red of REDES) {
      salida[red] = {
        nombre: INFO_REDES[red].nombre,
        automatica: INFO_REDES[red].automatica,
        conectada: this.conectada(red),
      };
    }
    return salida;
  }

  ficha() {
    return { ficha: FICHA_MARCA, redes: INFO_REDES };
  }

  // --- Consulta -----------------------------------------------------------

  listar(estado?: EstadoPublicacionRedes): Promise<PublicacionRedes[]> {
    return this.repo.find({
      where: estado ? { estado } : {},
      order: { fechaProgramada: 'ASC', creadoEn: 'DESC' },
      take: 200,
    });
  }

  async obtener(id: string): Promise<PublicacionRedes> {
    const pub = await this.repo.findOne({ where: { id } });
    if (!pub) throw new NotFoundException('Publicación no encontrada.');
    return pub;
  }

  // --- Creación -----------------------------------------------------------

  private redesValidas(redes?: RedSocial[]): RedSocial[] {
    const lista = (redes && redes.length > 0 ? redes : REDES).filter((r) => REDES.includes(r));
    return Array.from(new Set(lista));
  }

  crearManual(dto: CrearPublicacionDto, usuarioId: string): Promise<PublicacionRedes> {
    const pub = this.repo.create({
      titulo: dto.titulo?.trim() || 'Sin título',
      tema: dto.tema,
      redes: this.redesValidas(dto.redes),
      textos: dto.textos ?? {},
      enlaceDestino: dto.enlaceDestino,
      estado: 'borrador',
      resultados: {},
      creadoPorId: usuarioId,
    });
    return this.repo.save(pub);
  }

  async generar(dto: GenerarPublicacionDto, usuarioId: string): Promise<PublicacionRedes> {
    const redes = this.redesValidas(dto.redes);
    const textos = await this.redaccion.redactar({
      tema: dto.tema,
      contexto: dto.contexto,
      enlace: dto.enlace,
      redes,
    });
    const pub = this.repo.create({
      titulo: dto.tema.trim().slice(0, 120),
      tema: dto.tema,
      redes,
      textos,
      enlaceDestino: dto.enlace,
      estado: 'pendiente_aprobacion',
      resultados: {},
      creadoPorId: usuarioId,
    });
    return this.repo.save(pub);
  }

  async desdeBlog(blogId: string, redes: RedSocial[] | undefined, usuarioId: string) {
    const blog = await this.blogService.obtener(blogId);
    const lista = this.redesValidas(redes);
    const cuerpo = textoPlano(blog.contenidoHtml ?? '');
    const textos = await this.redaccion.redactar({
      tema: blog.titulo,
      contexto: `${blog.extracto ?? ''}\n\n${cuerpo}`.trim(),
      enlace: blog.wordpressEnlace,
      redes: lista,
    });
    const pub = this.repo.create({
      titulo: blog.titulo.slice(0, 200),
      tema: blog.titulo,
      redes: lista,
      textos,
      imagenClave: blog.imagenDestacadaClave,
      enlaceDestino: blog.wordpressEnlace,
      blogPostId: blog.id,
      estado: 'pendiente_aprobacion',
      resultados: {},
      creadoPorId: usuarioId,
    });
    const guardada = await this.repo.save(pub);
    return {
      publicacion: guardada,
      advertencia: blog.wordpressEnlace
        ? undefined
        : 'El blog todavía no está publicado, así que las publicaciones salen sin enlace. Publica el blog primero y vuelve a generar para que incluya el enlace.',
    };
  }

  async sugerirSemana(dto: SugerirSemanaDto, usuarioId: string): Promise<PublicacionRedes[]> {
    const redes = this.redesValidas(dto.redes);
    const ideas = await this.redaccion.sugerirSemana(dto.cantidad ?? 5, redes);
    if (ideas.length === 0) throw new BadRequestException('No se generaron ideas. Intenta de nuevo.');
    const nuevas = ideas.map((idea) =>
      this.repo.create({
        titulo: idea.titulo.slice(0, 200),
        tema: idea.tema,
        redes,
        textos: idea.textos,
        estado: 'pendiente_aprobacion',
        resultados: {},
        creadoPorId: usuarioId,
      }),
    );
    return this.repo.save(nuevas);
  }

  // --- Edición ------------------------------------------------------------

  private asegurarEditable(pub: PublicacionRedes): void {
    if (pub.estado === 'publicada' || pub.estado === 'publicando') {
      throw new BadRequestException('Esta publicación ya salió (o está saliendo) y no se puede editar.');
    }
  }

  /** Cualquier cambio a una publicación programada exige aprobarla de nuevo. */
  private reabrirAprobacion(pub: PublicacionRedes): void {
    if (pub.estado === 'programada') {
      pub.estado = 'pendiente_aprobacion';
      pub.fechaProgramada = undefined;
      pub.aprobadoPorId = undefined;
      pub.aprobadoEn = undefined;
    }
  }

  async actualizar(id: string, dto: ActualizarPublicacionDto): Promise<PublicacionRedes> {
    const pub = await this.obtener(id);
    this.asegurarEditable(pub);
    if (dto.titulo !== undefined) pub.titulo = dto.titulo.trim() || pub.titulo;
    if (dto.redes !== undefined) pub.redes = this.redesValidas(dto.redes);
    if (dto.textos !== undefined) pub.textos = { ...pub.textos, ...dto.textos };
    if (dto.enlaceDestino !== undefined) pub.enlaceDestino = dto.enlaceDestino || undefined;
    this.reabrirAprobacion(pub);
    return this.repo.save(pub);
  }

  async regenerar(id: string, instrucciones?: string): Promise<PublicacionRedes> {
    const pub = await this.obtener(id);
    this.asegurarEditable(pub);
    let contexto: string | undefined;
    if (pub.blogPostId) {
      const blog = await this.blogService.obtener(pub.blogPostId).catch(() => undefined);
      if (blog) contexto = `${blog.extracto ?? ''}\n\n${textoPlano(blog.contenidoHtml ?? '')}`.trim();
    }
    pub.textos = await this.redaccion.redactar({
      tema: pub.tema || pub.titulo,
      contexto,
      enlace: pub.enlaceDestino,
      redes: pub.redes.length > 0 ? pub.redes : REDES,
      instrucciones,
    });
    this.reabrirAprobacion(pub);
    if (pub.estado === 'borrador') pub.estado = 'pendiente_aprobacion';
    return this.repo.save(pub);
  }

  async subirImagen(id: string, archivo: Express.Multer.File): Promise<PublicacionRedes> {
    const pub = await this.obtener(id);
    this.asegurarEditable(pub);
    const clave = `community-manager/${id}/${Date.now()}-${archivo.originalname}`;
    await this.almacenamiento.subir(clave, archivo.buffer, archivo.mimetype);
    pub.imagenClave = clave;
    this.reabrirAprobacion(pub);
    return this.repo.save(pub);
  }

  async urlImagen(id: string): Promise<string | null> {
    const pub = await this.obtener(id);
    if (!pub.imagenClave) return null;
    return this.almacenamiento.urlLecturaPublica(pub.imagenClave, 1800);
  }

  async eliminar(id: string): Promise<{ eliminada: true }> {
    const pub = await this.obtener(id);
    if (pub.estado === 'publicando') throw new BadRequestException('Se está publicando ahora mismo; espera un momento.');
    await this.repo.delete(id);
    return { eliminada: true };
  }

  // --- Aprobación y publicación ------------------------------------------

  private validarListo(pub: PublicacionRedes): void {
    if (pub.redes.length === 0) throw new BadRequestException('Elige al menos una red.');
    for (const red of pub.redes) {
      const texto = (pub.textos[red] ?? '').trim();
      const nombre = INFO_REDES[red].nombre;
      if (!texto) throw new BadRequestException(`Falta el texto de ${nombre}.`);
      if (texto.length > LIMITE_DURO[red]) {
        throw new BadRequestException(`El texto de ${nombre} pasa el límite de ${LIMITE_DURO[red]} caracteres.`);
      }
    }
    if (pub.redes.includes('instagram') && !pub.imagenClave) {
      throw new BadRequestException('Instagram necesita una imagen: sube una foto o quita Instagram de las redes.');
    }
  }

  async aprobarYProgramar(id: string, fechaIso: string, usuarioId: string): Promise<PublicacionRedes> {
    const pub = await this.obtener(id);
    this.asegurarEditable(pub);
    this.validarListo(pub);
    const fecha = new Date(fechaIso);
    if (Number.isNaN(fecha.getTime()) || fecha.getTime() < Date.now() - 60_000) {
      throw new BadRequestException('Elige una fecha y hora futuras.');
    }
    pub.fechaProgramada = fecha;
    pub.estado = 'programada';
    pub.aprobadoPorId = usuarioId;
    pub.aprobadoEn = new Date();
    pub.resultados = {};
    return this.repo.save(pub);
  }

  async aprobarYPublicar(id: string, usuarioId: string): Promise<PublicacionRedes> {
    const pub = await this.obtener(id);
    this.asegurarEditable(pub);
    this.validarListo(pub);
    pub.aprobadoPorId = usuarioId;
    pub.aprobadoEn = new Date();
    await this.repo.save(pub);
    return this.publicarInterno(pub.id);
  }

  async reintentar(id: string): Promise<PublicacionRedes> {
    const pub = await this.obtener(id);
    if (!pub.aprobadoEn) throw new BadRequestException('Primero hay que aprobar la publicación.');
    if (pub.estado !== 'parcial' && pub.estado !== 'fallida') {
      throw new BadRequestException('Solo se pueden reintentar publicaciones con redes pendientes o fallidas.');
    }
    this.validarListo(pub);
    return this.publicarInterno(pub.id);
  }

  async marcarManual(id: string, red: RedSocial, enlace?: string): Promise<PublicacionRedes> {
    const pub = await this.obtener(id);
    if (!pub.aprobadoEn) throw new BadRequestException('Primero hay que aprobar la publicación.');
    if (!pub.redes.includes(red)) throw new BadRequestException('Esa red no está en la publicación.');
    const previo = pub.resultados[red];
    if (previo?.estado === 'publicada') throw new BadRequestException('Esa red ya se publicó sola.');
    pub.resultados = {
      ...pub.resultados,
      [red]: { estado: 'manual_hecha', enlace: enlace?.trim() || undefined, en: AHORA() },
    };
    this.recalcularEstado(pub);
    return this.repo.save(pub);
  }

  private recalcularEstado(pub: PublicacionRedes): void {
    const estados = pub.redes.map((r) => pub.resultados[r]?.estado);
    const hechas = (e?: string) => e === 'publicada' || e === 'manual_hecha';
    if (estados.every(hechas)) {
      pub.estado = 'publicada';
      pub.publicadoEn = pub.publicadoEn ?? new Date();
    } else if (estados.some(hechas)) {
      pub.estado = 'parcial';
    } else if (estados.some((e) => e === 'fallida')) {
      pub.estado = 'fallida';
    } else {
      pub.estado = 'parcial';
    }
  }

  private async publicarEnRed(
    red: RedSocial,
    texto: string,
    imagenUrl?: string,
    enlace?: string,
  ): Promise<{ idExterno?: string; enlace?: string }> {
    switch (red) {
      case 'facebook':
        return this.meta.publicarEnFacebook(texto, imagenUrl, enlace);
      case 'instagram':
        return this.meta.publicarEnInstagram(texto, imagenUrl);
      case 'linkedin':
        return this.linkedin.publicar(texto, imagenUrl);
      case 'threads':
        return this.threads.publicar(texto, imagenUrl);
      default:
        throw new BadRequestException('Esta red se publica a mano.');
    }
  }

  /** Publica en las redes conectadas y deja listas las demás. Idempotente: salta lo ya publicado. */
  private async publicarInterno(id: string): Promise<PublicacionRedes> {
    // Toma la publicación de forma atómica para que dos disparos (botón y
    // cron) no publiquen dos veces lo mismo.
    const tomada = await this.repo
      .createQueryBuilder()
      .update(PublicacionRedes)
      .set({ estado: 'publicando' })
      .where('id = :id AND estado NOT IN (:...bloqueados)', { id, bloqueados: ['publicando', 'publicada'] })
      .execute();
    if (!tomada.affected) {
      throw new BadRequestException('Esta publicación ya se publicó o se está publicando.');
    }

    const pub = await this.obtener(id);
    try {
      let imagenUrl: string | undefined;
      if (pub.imagenClave) {
        imagenUrl = (await this.almacenamiento.urlLecturaPublica(pub.imagenClave, 1800)) ?? undefined;
      }

      const resultados: Partial<Record<RedSocial, ResultadoRed>> = { ...pub.resultados };
      for (const red of pub.redes) {
        const previo = resultados[red];
        if (previo?.estado === 'publicada' || previo?.estado === 'manual_hecha') continue;

        const info = INFO_REDES[red];
        const texto = (pub.textos[red] ?? '').trim();

        if (!this.conectada(red)) {
          resultados[red] = {
            estado: 'manual_pendiente',
            mensaje: info.automatica
              ? 'La conexión automática de esta red todavía no está configurada: publícala a mano (copia el texto) o configura las variables del servidor.'
              : 'Esta red se publica a mano: copia el texto, sube la imagen y marca la publicación como hecha.',
          };
          continue;
        }

        try {
          const r = await this.publicarEnRed(red, texto, imagenUrl, pub.enlaceDestino);
          resultados[red] = { estado: 'publicada', idExterno: r.idExterno, enlace: r.enlace, en: AHORA() };
        } catch (err) {
          const mensaje = err instanceof Error ? err.message : 'Error desconocido';
          this.logger.error(`Community Manager: falló ${red} en publicación ${id}: ${mensaje}`);
          resultados[red] = { estado: 'fallida', mensaje, en: AHORA() };
        }
      }
      pub.resultados = resultados;
      this.recalcularEstado(pub);
    } catch (err) {
      this.logger.error(`Community Manager: error inesperado publicando ${id}: ${(err as Error).message}`);
      pub.estado = 'fallida';
    }
    return this.repo.save(pub);
  }

  // --- Cron ---------------------------------------------------------------

  async publicarVencidas(): Promise<number> {
    const ahora = new Date();
    const vencidas = await this.repo
      .createQueryBuilder('p')
      .where('p.estado = :estado', { estado: 'programada' })
      .andWhere('p.fechaProgramada <= :ahora', { ahora })
      .getMany();
    let publicadas = 0;
    for (const pub of vencidas) {
      try {
        await this.publicarInterno(pub.id);
        publicadas++;
      } catch (err) {
        this.logger.warn(`Community Manager: no se pudo publicar ${pub.id}: ${(err as Error).message}`);
      }
    }
    return publicadas;
  }
}
