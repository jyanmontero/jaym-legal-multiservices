import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlogPost } from './blog-post.entity.js';
import { AlmacenamientoService } from '../documentos/almacenamiento.service.js';
import { RedaccionBlogService } from './redaccion-blog.service.js';
import { WordpressBlogService } from './wordpress-blog.service.js';
import { construirHtmlWordpress } from './plantilla-articulo-blog.js';
import { CrearBlogPostDto } from './dto/crear-blog-post.dto.js';
import { ActualizarBlogPostDto } from './dto/actualizar-blog-post.dto.js';
import { GenerarBorradorBlogDto } from './dto/generar-borrador-blog.dto.js';
import { EstadoBlogPost, MateriaJuridica } from '../common/enums/index.js';

const ETIQUETAS_AREA_CATEGORIA: Record<MateriaJuridica, string> = {
  [MateriaJuridica.CIVIL]: 'Derecho Civil',
  [MateriaJuridica.COMERCIAL]: 'Derecho Comercial',
  [MateriaJuridica.PENAL]: 'Derecho Penal',
  [MateriaJuridica.LABORAL]: 'Derecho Laboral',
  [MateriaJuridica.FAMILIA]: 'Derecho de Familia',
  [MateriaJuridica.INMOBILIARIO]: 'Derecho Inmobiliario',
  [MateriaJuridica.MIGRATORIO]: 'Derecho Migratorio',
  [MateriaJuridica.ADMINISTRATIVO]: 'Derecho Administrativo',
  [MateriaJuridica.CONSTITUCIONAL]: 'Derecho Constitucional',
  [MateriaJuridica.REGISTRO_CIVIL_JCE]: 'Registro Civil y JCE',
  [MateriaJuridica.NOTARIAL]: 'Derecho Notarial',
  [MateriaJuridica.CORPORATIVO]: 'Derecho Corporativo',
  [MateriaJuridica.PROPIEDAD_INTELECTUAL]: 'Propiedad Intelectual',
  [MateriaJuridica.COBROS]: 'Cobros',
  [MateriaJuridica.PROTECCION_CONSUMIDOR]: 'Protección al Consumidor',
  [MateriaJuridica.SEGURIDAD_SOCIAL]: 'Seguridad Social',
  [MateriaJuridica.OTRA]: 'Blog',
};

/**
 * Blog de jaymlegalmultiservices.com -- ver blog-post.entity.ts para el
 * flujo de estados. Este servicio cubre tanto el CRUD normal (escribir,
 * editar, generar con IA) como la publicación real hacia WordPress, que
 * también reutiliza el scheduler (blog.scheduler.ts) para publicar solo en
 * la fecha programada, sin intervención de Joseph.
 */
@Injectable()
export class BlogService {
  private readonly logger = new Logger(BlogService.name);

  constructor(
    @InjectRepository(BlogPost)
    private readonly repo: Repository<BlogPost>,
    private readonly almacenamiento: AlmacenamientoService,
    private readonly redaccionBlog: RedaccionBlogService,
    private readonly wordpressBlog: WordpressBlogService,
  ) {}

  credencialesConfiguradas(): boolean {
    return this.wordpressBlog.credencialesConfiguradas();
  }

  async crear(dto: CrearBlogPostDto, usuarioId: string): Promise<BlogPost> {
    const post = this.repo.create({
      titulo: dto.titulo?.trim() || 'Sin título',
      contenidoHtml: dto.contenidoHtml ?? '',
      extracto: dto.extracto,
      areaPractica: dto.areaPractica,
      temaOriginal: dto.temaOriginal,
      estado: EstadoBlogPost.BORRADOR,
      creadoPorId: usuarioId,
    });
    return this.repo.save(post);
  }

  async listar(estado?: EstadoBlogPost): Promise<BlogPost[]> {
    return this.repo.find({
      where: estado ? { estado } : {},
      // Ordenados por fecha programada (los sin fecha -- borradores -- al
      // final) para que la vista de calendario del frontend muestre la cola
      // de publicación en orden cronológico real.
      order: { fechaProgramada: 'ASC', creadoEn: 'DESC' },
    });
  }

  async obtener(id: string): Promise<BlogPost> {
    const post = await this.repo.findOne({ where: { id } });
    if (!post) throw new NotFoundException('Blog no encontrado.');
    return post;
  }

  async actualizar(id: string, dto: ActualizarBlogPostDto): Promise<BlogPost> {
    const post = await this.obtener(id);
    if (post.estado === EstadoBlogPost.PUBLICADO) {
      throw new BadRequestException('Este blog ya fue publicado -- no se puede editar desde aquí.');
    }

    if (dto.titulo !== undefined) post.titulo = dto.titulo;
    if (dto.contenidoHtml !== undefined) post.contenidoHtml = dto.contenidoHtml;
    if (dto.extracto !== undefined) post.extracto = dto.extracto;
    if (dto.areaPractica !== undefined) post.areaPractica = dto.areaPractica;
    if (dto.temaOriginal !== undefined) post.temaOriginal = dto.temaOriginal;

    // Cambiar la fecha programada -- una cadena vacía "desprograma" (vuelve
    // a borrador); una fecha nueva reprograma (incluso si estaba en fallido).
    if (dto.fechaProgramada !== undefined) {
      if (dto.fechaProgramada) {
        post.fechaProgramada = dto.fechaProgramada;
        post.estado = EstadoBlogPost.PROGRAMADO;
        post.motivoFallo = undefined;
      } else {
        post.fechaProgramada = undefined;
        post.estado = EstadoBlogPost.BORRADOR;
      }
    }

    return this.repo.save(post);
  }

  async programar(id: string, fechaProgramada: string): Promise<BlogPost> {
    const post = await this.obtener(id);
    if (post.estado === EstadoBlogPost.PUBLICADO) {
      throw new BadRequestException('Este blog ya fue publicado.');
    }
    if (!post.titulo?.trim() || !post.contenidoHtml?.trim()) {
      throw new BadRequestException('El blog necesita título y contenido antes de programarlo.');
    }
    post.fechaProgramada = fechaProgramada;
    post.estado = EstadoBlogPost.PROGRAMADO;
    post.motivoFallo = undefined;
    return this.repo.save(post);
  }

  async eliminar(id: string): Promise<void> {
    const post = await this.obtener(id);
    if (post.estado === EstadoBlogPost.PUBLICADO) {
      throw new BadRequestException('Este blog ya fue publicado en el sitio -- no se puede eliminar desde aquí.');
    }
    await this.repo.remove(post);
  }

  async urlImagenDestacada(id: string): Promise<string | null> {
    const post = await this.obtener(id);
    if (!post.imagenDestacadaClave) return null;
    return this.almacenamiento.urlLecturaPublica(post.imagenDestacadaClave, 600);
  }

  async subirImagenDestacada(id: string, archivo: Express.Multer.File): Promise<BlogPost> {
    const post = await this.obtener(id);
    const clave = `blog/${id}/${Date.now()}-${archivo.originalname}`;
    await this.almacenamiento.subir(clave, archivo.buffer, archivo.mimetype);
    post.imagenDestacadaClave = clave;
    return this.repo.save(post);
  }

  async generarBorrador(id: string, dto: GenerarBorradorBlogDto): Promise<BlogPost> {
    const post = await this.obtener(id);
    if (post.estado === EstadoBlogPost.PUBLICADO) {
      throw new BadRequestException('Este blog ya fue publicado -- no se puede regenerar.');
    }
    const borrador = await this.redaccionBlog.generarBorrador(dto.tema, dto.areaPractica);
    post.titulo = borrador.titulo;
    post.contenidoHtml = borrador.contenidoHtml;
    post.extracto = borrador.extracto;
    post.temaOriginal = dto.tema;
    if (dto.areaPractica) post.areaPractica = dto.areaPractica;
    return this.repo.save(post);
  }

  /** Publica de inmediato, sin importar la fecha programada (botón "Publicar ahora"). */
  async publicarAhora(id: string): Promise<BlogPost> {
    const post = await this.obtener(id);
    if (post.estado === EstadoBlogPost.PUBLICADO) {
      throw new BadRequestException('Este blog ya fue publicado.');
    }
    if (!post.titulo?.trim() || !post.contenidoHtml?.trim()) {
      throw new BadRequestException('El blog necesita título y contenido antes de publicarlo.');
    }
    return this.publicarInterno(post);
  }

  /** Usado por el cron diario (blog.scheduler.ts) -- nunca lanza, deja el error registrado en el propio blog (estado fallido). */
  async publicarSilencioso(post: BlogPost): Promise<void> {
    try {
      await this.publicarInterno(post);
    } catch (error) {
      post.estado = EstadoBlogPost.FALLIDO;
      post.motivoFallo = (error as Error).message;
      await this.repo.save(post);
      this.logger.error(`Publicación programada del blog ${post.id} falló: ${(error as Error).message}`);
    }
  }

  private async publicarInterno(post: BlogPost): Promise<BlogPost> {
    let idImagenDestacada: number | undefined;
    if (post.imagenDestacadaClave) {
      const url = await this.almacenamiento.urlLecturaPublica(post.imagenDestacadaClave, 1800);
      if (!url) {
        throw new BadRequestException(
          'El almacenamiento de imágenes no está configurado para producción (falta R2) -- no se puede publicar el blog.',
        );
      }
      const nombreArchivo = post.imagenDestacadaClave.split('/').pop() ?? 'imagen.jpg';
      const tipoMime = nombreArchivo.toLowerCase().endsWith('.png')
        ? 'image/png'
        : nombreArchivo.toLowerCase().endsWith('.webp')
          ? 'image/webp'
          : 'image/jpeg';
      idImagenDestacada = await this.wordpressBlog.subirImagen(url, nombreArchivo, tipoMime);
    }

    const idCategoria = post.areaPractica
      ? await this.wordpressBlog.buscarOCrearCategoria(ETIQUETAS_AREA_CATEGORIA[post.areaPractica])
      : undefined;

    const resultado = await this.wordpressBlog.publicarPost({
      postIdExistente: post.wordpressPostId,
      titulo: post.titulo,
      contenidoHtml: construirHtmlWordpress({
        contenidoHtml: post.contenidoHtml,
        extracto: post.extracto,
        areaPractica: post.areaPractica,
      }),
      extracto: post.extracto,
      idCategoria,
      idImagenDestacada,
    });

    post.wordpressPostId = resultado.id;
    post.wordpressEnlace = resultado.enlace;
    post.estado = EstadoBlogPost.PUBLICADO;
    post.publicadoEn = new Date();
    post.motivoFallo = undefined;
    return this.repo.save(post);
  }

  /** Usado por el scheduler: blogs programados cuya fecha ya llegó (hoy o antes -- por si el servidor estuvo caído un día). */
  async listarPendientesDeHoy(hoyIso: string): Promise<BlogPost[]> {
    return this.repo
      .createQueryBuilder('post')
      .where('post.estado = :estado', { estado: EstadoBlogPost.PROGRAMADO })
      .andWhere('post."fechaProgramada" <= :hoy', { hoy: hoyIso })
      .getMany();
  }
}
