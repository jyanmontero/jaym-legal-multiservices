import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface TerminoWp {
  id: number;
  name: string;
  slug: string;
}

/**
 * Cliente delgado para la REST API de WordPress de jaymlegalmultiservices.com
 * (sitio de marketing de JAYM Legal, tema Hello Elementor). Publica cada
 * BlogPost como una entrada estándar (`posts`) del blog -- a diferencia del
 * Portal Inmobiliario, aquí no hay ningún tipo de contenido personalizado
 * (`estate_property`); es el blog nativo de WordPress.
 *
 * Requiere en el .env / variables de entorno de Render:
 *   WORDPRESS_BLOG_SITE_URL       -- opcional, por defecto https://jaymlegalmultiservices.com
 *   WORDPRESS_BLOG_APP_USER       -- usuario de WordPress dueño de la Application Password
 *   WORDPRESS_BLOG_APP_PASSWORD   -- Application Password generada en el perfil de ese usuario
 *                                     (nunca la contraseña real de la cuenta -- Joseph la genera
 *                                     desde Usuarios → Perfil → Contraseñas de aplicación)
 *
 * Ver claude/auditoria-sitio-jaymlegalmultiservices-2026-09-23.md: al momento
 * de escribir esto, Joseph no tenía cuenta propia en ese WordPress (solo la
 * del contratista que armó el sitio) -- necesita crear la suya primero.
 */
@Injectable()
export class WordpressBlogService {
  private readonly logger = new Logger(WordpressBlogService.name);
  private cacheCategorias: TerminoWp[] | null = null;

  constructor(private readonly config: ConfigService) {}

  private siteUrl(): string {
    return (this.config.get<string>('WORDPRESS_BLOG_SITE_URL') || 'https://jaymlegalmultiservices.com').replace(
      /\/$/,
      '',
    );
  }

  private usuario(): string {
    const usuario = this.config.get<string>('WORDPRESS_BLOG_APP_USER');
    if (!usuario) throw new BadRequestException('Falta configurar WORDPRESS_BLOG_APP_USER en el servidor.');
    return usuario;
  }

  private appPassword(): string {
    const clave = this.config.get<string>('WORDPRESS_BLOG_APP_PASSWORD');
    if (!clave) throw new BadRequestException('Falta configurar WORDPRESS_BLOG_APP_PASSWORD en el servidor.');
    return clave;
  }

  /** Credenciales configuradas -- lo usa el frontend para avisar antes de intentar programar/publicar. */
  credencialesConfiguradas(): boolean {
    return Boolean(
      this.config.get<string>('WORDPRESS_BLOG_APP_USER') && this.config.get<string>('WORDPRESS_BLOG_APP_PASSWORD'),
    );
  }

  private cabeceraAuth(): string {
    const token = Buffer.from(`${this.usuario()}:${this.appPassword()}`).toString('base64');
    return `Basic ${token}`;
  }

  /** Sube una imagen (obtenida como bytes desde una URL firmada de R2) a la biblioteca de medios de WordPress. Devuelve el ID del adjunto. */
  async subirImagen(urlImagen: string, nombreArchivo: string, tipoMime: string): Promise<number> {
    const respuestaDescarga = await fetch(urlImagen);
    if (!respuestaDescarga.ok) {
      throw new BadRequestException(`No se pudo descargar la imagen para subirla al blog: ${urlImagen}`);
    }
    const bytes = Buffer.from(await respuestaDescarga.arrayBuffer());

    const respuesta = await fetch(`${this.siteUrl()}/wp-json/wp/v2/media`, {
      method: 'POST',
      headers: {
        Authorization: this.cabeceraAuth(),
        'Content-Type': tipoMime,
        'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
      },
      body: bytes,
    });
    const datos = (await respuesta.json()) as { id?: number; message?: string };
    if (!respuesta.ok || !datos.id) {
      this.logger.error(`Subida de imagen a WordPress (blog) falló: ${JSON.stringify(datos)}`);
      throw new BadRequestException(`WordPress rechazó la imagen: ${datos.message ?? 'error desconocido'}`);
    }
    return datos.id;
  }

  /** Busca una categoría del blog por nombre exacto (sin distinguir mayúsculas); la crea si no existe. Devuelve su ID. */
  async buscarOCrearCategoria(nombre: string): Promise<number> {
    const nombreNormalizado = nombre.trim();
    if (!nombreNormalizado) {
      throw new BadRequestException('Nombre de categoría vacío.');
    }

    if (!this.cacheCategorias) {
      const respuesta = await fetch(`${this.siteUrl()}/wp-json/wp/v2/categories?per_page=100`, {
        headers: { Authorization: this.cabeceraAuth() },
      });
      this.cacheCategorias = respuesta.ok ? ((await respuesta.json()) as TerminoWp[]) : [];
    }

    const existente = this.cacheCategorias.find((t) => t.name.toLowerCase() === nombreNormalizado.toLowerCase());
    if (existente) return existente.id;

    const respuestaCrear = await fetch(`${this.siteUrl()}/wp-json/wp/v2/categories`, {
      method: 'POST',
      headers: { Authorization: this.cabeceraAuth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nombreNormalizado }),
    });
    const creado = (await respuestaCrear.json()) as TerminoWp & { message?: string };
    if (!respuestaCrear.ok || !creado.id) {
      this.logger.error(`Creación de categoría "${nombreNormalizado}" falló: ${JSON.stringify(creado)}`);
      throw new BadRequestException(
        `WordPress rechazó crear la categoría "${nombreNormalizado}": ${creado.message ?? 'error desconocido'}`,
      );
    }
    this.cacheCategorias.push(creado);
    return creado.id;
  }

  /**
   * Publica (o actualiza si ya existe) la entrada del blog. Devuelve el ID
   * del post en WordPress y el enlace público.
   */
  async publicarPost(datos: {
    postIdExistente?: number;
    titulo: string;
    contenidoHtml: string;
    extracto?: string;
    idCategoria?: number;
    idImagenDestacada?: number;
  }): Promise<{ id: number; enlace: string }> {
    const cuerpo: Record<string, unknown> = {
      title: datos.titulo,
      content: datos.contenidoHtml,
      status: 'publish',
    };
    if (datos.extracto) {
      cuerpo.excerpt = datos.extracto;
    }
    if (datos.idCategoria) {
      cuerpo.categories = [datos.idCategoria];
    }
    if (datos.idImagenDestacada) {
      cuerpo.featured_media = datos.idImagenDestacada;
    }

    const ruta = datos.postIdExistente
      ? `${this.siteUrl()}/wp-json/wp/v2/posts/${datos.postIdExistente}`
      : `${this.siteUrl()}/wp-json/wp/v2/posts`;

    const respuesta = await fetch(ruta, {
      method: 'POST',
      headers: { Authorization: this.cabeceraAuth(), 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
    const creado = (await respuesta.json()) as { id?: number; link?: string; message?: string };
    if (!respuesta.ok || !creado.id) {
      this.logger.error(`Publicación de blog en WordPress falló: ${JSON.stringify(creado)}`);
      throw new BadRequestException(`WordPress rechazó la publicación del blog: ${creado.message ?? 'error desconocido'}`);
    }

    return { id: creado.id, enlace: creado.link ?? '' };
  }
}
