import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface TerminoWp {
  id: number;
  name: string;
  slug: string;
}

/**
 * Cliente delgado para la REST API de WordPress del portal inmobiliario
 * (jaymportalinmobiliario.com, tema WP Residence). Publica cada anuncio del
 * módulo Marketing Inmobiliario como un `estate_property` real.
 *
 * Requiere en el .env / variables de entorno de Render:
 *   WORDPRESS_SITE_URL       -- opcional, por defecto https://jaymportalinmobiliario.com
 *   WORDPRESS_APP_USER       -- usuario de WordPress dueño de la Application Password
 *   WORDPRESS_APP_PASSWORD   -- Application Password generada en el perfil de ese usuario
 *                                (nunca la contraseña real de la cuenta)
 *
 * Importante -- limitación conocida del tema: WP Residence no expone por
 * REST los campos propios de la ficha (precio, habitaciones, baños, metros,
 * dirección como campos numéricos/estructurados: property_price,
 * property_bedrooms, property_bathrooms, property_size, property_address).
 * Este servicio los envía de todas formas en `meta` (WordPress simplemente
 * los ignora si no están registrados para REST), y además los incluye
 * siempre en el texto/contenido del anuncio para que la ficha nunca quede
 * incompleta de cara al público. Para que también aparezcan como campos
 * estructurados del tema (con precio destacado, filtros de búsqueda, etc.)
 * hace falta agregar un pequeño fragmento de código en el tema hijo
 * (functions.php) que los registre con `register_post_meta` -- no es algo
 * que se pueda hacer vía REST, por lo que queda documentado en el README
 * del módulo para que Joseph lo agregue desde el editor de temas.
 */
@Injectable()
export class WordpressPortalService {
  private readonly logger = new Logger(WordpressPortalService.name);
  private cacheTerminos = new Map<string, TerminoWp[]>();

  constructor(private readonly config: ConfigService) {}

  private siteUrl(): string {
    return (this.config.get<string>('WORDPRESS_SITE_URL') || 'https://jaymportalinmobiliario.com').replace(/\/$/, '');
  }

  private usuario(): string {
    const usuario = this.config.get<string>('WORDPRESS_APP_USER');
    if (!usuario) throw new BadRequestException('Falta configurar WORDPRESS_APP_USER en el servidor.');
    return usuario;
  }

  private appPassword(): string {
    const clave = this.config.get<string>('WORDPRESS_APP_PASSWORD');
    if (!clave) throw new BadRequestException('Falta configurar WORDPRESS_APP_PASSWORD en el servidor.');
    return clave;
  }

  /** Credenciales configuradas -- lo usa el frontend para avisar antes de intentar publicar. */
  credencialesConfiguradas(): boolean {
    return Boolean(
      this.config.get<string>('WORDPRESS_APP_USER') && this.config.get<string>('WORDPRESS_APP_PASSWORD'),
    );
  }

  private cabeceraAuth(): string {
    const token = Buffer.from(`${this.usuario()}:${this.appPassword()}`).toString('base64');
    return `Basic ${token}`;
  }

  /** Sube una foto (obtenida como bytes desde una URL firmada de R2) a la biblioteca de medios de WordPress. Devuelve el ID del adjunto. */
  async subirFoto(urlFoto: string, nombreArchivo: string, tipoMime: string): Promise<number> {
    const respuestaDescarga = await fetch(urlFoto);
    if (!respuestaDescarga.ok) {
      throw new BadRequestException(`No se pudo descargar la foto para subirla al portal: ${urlFoto}`);
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
      this.logger.error(`Subida de media a WordPress falló: ${JSON.stringify(datos)}`);
      throw new BadRequestException(`WordPress rechazó la foto: ${datos.message ?? 'error desconocido'}`);
    }
    return datos.id;
  }

  /** Busca un término de una taxonomía por nombre exacto (sin distinguir mayúsculas); lo crea si no existe. Devuelve su ID. */
  async buscarOCrearTermino(taxonomia: string, nombre: string): Promise<number> {
    const nombreNormalizado = nombre.trim();
    if (!nombreNormalizado) {
      throw new BadRequestException(`Nombre vacío para la taxonomía ${taxonomia}.`);
    }

    let terminos = this.cacheTerminos.get(taxonomia);
    if (!terminos) {
      const respuesta = await fetch(`${this.siteUrl()}/wp-json/wp/v2/${taxonomia}?per_page=100`, {
        headers: { Authorization: this.cabeceraAuth() },
      });
      terminos = respuesta.ok ? ((await respuesta.json()) as TerminoWp[]) : [];
      this.cacheTerminos.set(taxonomia, terminos);
    }

    const existente = terminos.find((t) => t.name.toLowerCase() === nombreNormalizado.toLowerCase());
    if (existente) return existente.id;

    const respuestaCrear = await fetch(`${this.siteUrl()}/wp-json/wp/v2/${taxonomia}`, {
      method: 'POST',
      headers: { Authorization: this.cabeceraAuth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nombreNormalizado }),
    });
    const creado = (await respuestaCrear.json()) as TerminoWp & { message?: string };
    if (!respuestaCrear.ok || !creado.id) {
      this.logger.error(`Creación de término ${taxonomia}="${nombreNormalizado}" falló: ${JSON.stringify(creado)}`);
      throw new BadRequestException(
        `WordPress rechazó crear la zona/categoría "${nombreNormalizado}": ${creado.message ?? 'error desconocido'}`,
      );
    }
    terminos.push(creado);
    return creado.id;
  }

  /**
   * Publica (o actualiza si ya existe) el `estate_property`. Devuelve el ID
   * del post en WordPress y el enlace público.
   */
  async publicarPropiedad(datos: {
    postIdExistente?: number;
    titulo: string;
    contenidoHtml: string;
    idsFotos: number[];
    idCategoriaZona?: number;
    idAccion: number; // property_action_category: En Venta / En Renta
    precio: number;
    habitaciones?: number;
    banos?: number;
    metrosCuadrados?: number;
    direccion?: string;
  }): Promise<{ id: number; enlace: string }> {
    const cuerpo: Record<string, unknown> = {
      title: datos.titulo,
      content: datos.contenidoHtml,
      status: 'publish',
      property_action_category: [datos.idAccion],
      // Estos campos solo tienen efecto una vez que se registren para REST
      // en el tema hijo (ver comentario al inicio del archivo); mientras
      // tanto WordPress los recibe y los ignora sin error.
      meta: {
        property_price: datos.precio,
        ...(datos.habitaciones != null ? { property_bedrooms: datos.habitaciones } : {}),
        ...(datos.banos != null ? { property_bathrooms: datos.banos } : {}),
        ...(datos.metrosCuadrados != null ? { property_size: datos.metrosCuadrados } : {}),
        ...(datos.direccion ? { property_address: datos.direccion } : {}),
      },
    };
    if (datos.idCategoriaZona) {
      cuerpo.property_city = [datos.idCategoriaZona];
    }
    if (datos.idsFotos.length > 0) {
      cuerpo.featured_media = datos.idsFotos[0];
    }

    const ruta = datos.postIdExistente
      ? `${this.siteUrl()}/wp-json/wp/v2/estate_property/${datos.postIdExistente}`
      : `${this.siteUrl()}/wp-json/wp/v2/estate_property`;

    const respuesta = await fetch(ruta, {
      method: 'POST',
      headers: { Authorization: this.cabeceraAuth(), 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
    const creado = (await respuesta.json()) as { id?: number; link?: string; message?: string };
    if (!respuesta.ok || !creado.id) {
      this.logger.error(`Publicación en WordPress falló: ${JSON.stringify(creado)}`);
      throw new BadRequestException(`WordPress rechazó la publicación: ${creado.message ?? 'error desconocido'}`);
    }
    return { id: creado.id, enlace: creado.link ?? '' };
  }
}
