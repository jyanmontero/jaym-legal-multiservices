import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface RespuestaMeta {
  id?: string;
  post_id?: string;
  status_code?: string;
  error?: { message: string; type?: string; code?: number; error_subcode?: number };
}

/**
 * Cliente delgado para la Graph API de Meta (Facebook Pages + Instagram
 * Content Publishing). Publica solo en las cuentas propias de JAYM Portal
 * Inmobiliario configuradas por variables de entorno -- no es una app
 * pública de terceros, así que no requiere pasar por la revisión de Meta
 * (App Review), solo que la cuenta esté agregada como administradora de la
 * App de Meta usada para generar el token.
 *
 * Requiere en el .env / variables de entorno de Render:
 *   META_PAGE_ID -- ID de la Página de Facebook
 *   META_PAGE_ACCESS_TOKEN -- token de acceso de larga duración de esa Página
 *   META_INSTAGRAM_BUSINESS_ACCOUNT_ID -- ID de la cuenta de Instagram Business vinculada
 *   META_GRAPH_API_VERSION -- opcional, por defecto 'v21.0'
 */
@Injectable()
export class MetaGraphService {
  private readonly logger = new Logger(MetaGraphService.name);

  constructor(private readonly config: ConfigService) {}

  private base(): string {
    const version = this.config.get<string>('META_GRAPH_API_VERSION') || 'v21.0';
    return `https://graph.facebook.com/${version}`;
  }

  private pageId(): string {
    const id = this.config.get<string>('META_PAGE_ID');
    if (!id) throw new BadRequestException('Falta configurar META_PAGE_ID en el servidor.');
    return id;
  }

  private pageToken(): string {
    const token = this.config.get<string>('META_PAGE_ACCESS_TOKEN');
    if (!token) throw new BadRequestException('Falta configurar META_PAGE_ACCESS_TOKEN en el servidor.');
    return token;
  }

  private igUserId(): string {
    const id = this.config.get<string>('META_INSTAGRAM_BUSINESS_ACCOUNT_ID');
    if (!id) throw new BadRequestException('Falta configurar META_INSTAGRAM_BUSINESS_ACCOUNT_ID en el servidor.');
    return id;
  }

  /** Credenciales configuradas -- lo usa el frontend para avisar antes de intentar publicar. */
  credencialesConfiguradas(): boolean {
    return Boolean(
      this.config.get<string>('META_PAGE_ID') &&
        this.config.get<string>('META_PAGE_ACCESS_TOKEN') &&
        this.config.get<string>('META_INSTAGRAM_BUSINESS_ACCOUNT_ID'),
    );
  }

  private async llamar(ruta: string, cuerpo: Record<string, string>): Promise<RespuestaMeta> {
    const respuesta = await fetch(`${this.base()}/${ruta}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(cuerpo).toString(),
    });
    const datos = (await respuesta.json()) as RespuestaMeta;
    if (!respuesta.ok || datos.error) {
      this.logger.error(`Graph API ${ruta} falló: ${JSON.stringify(datos.error ?? datos)}`);
      throw new BadRequestException(
        `Meta rechazó la publicación (${ruta}): ${datos.error?.message ?? 'error desconocido'}`,
      );
    }
    return datos;
  }

  private pausa(ms: number): Promise<void> {
    return new Promise((resolver) => setTimeout(resolver, ms));
  }

  /**
   * Instagram procesa la imagen de forma asíncrona después de crear el
   * contenedor. Si se llama a media_publish antes de que termine, Meta
   * responde "Media ID is not available" (código 9007 / subcódigo 2207027).
   * Se consulta el estado del contenedor hasta que sea FINISHED (máx. ~90 s).
   */
  private async esperarContenedorListo(creationId: string): Promise<void> {
    const consulta = new URLSearchParams({
      fields: 'status_code',
      access_token: this.pageToken(),
    }).toString();
    const intentosMaximos = 30;
    for (let i = 0; i < intentosMaximos; i++) {
      const respuesta = await fetch(`${this.base()}/${creationId}?${consulta}`);
      const datos = (await respuesta.json()) as RespuestaMeta;
      if (datos.error) {
        this.logger.error(`Graph API estado de ${creationId} falló: ${JSON.stringify(datos.error)}`);
        throw new BadRequestException(
          `Meta no pudo confirmar el estado del contenido: ${datos.error.message}`,
        );
      }
      if (datos.status_code === 'FINISHED') return;
      if (datos.status_code === 'ERROR' || datos.status_code === 'EXPIRED') {
        throw new BadRequestException(
          `Instagram no pudo procesar el contenido (estado ${datos.status_code}). Revisa que las fotos sean JPG/PNG públicas y de tamaño razonable.`,
        );
      }
      await this.pausa(3000);
    }
    throw new BadRequestException(
      'Instagram tardó demasiado en procesar las fotos. Intenta de nuevo en unos minutos o con fotos más livianas.',
    );
  }

  /** Publica en la Página de Facebook. Devuelve el ID del post. */
  async publicarEnFacebook(fotosUrls: string[], mensaje: string): Promise<string> {
    const pageId = this.pageId();
    const token = this.pageToken();

    if (fotosUrls.length === 1) {
      const resultado = await this.llamar(`${pageId}/photos`, {
        url: fotosUrls[0],
        caption: mensaje,
        access_token: token,
      });
      return resultado.post_id ?? resultado.id ?? '';
    }

    // Varias fotos: se suben primero sin publicar (published=false) y luego
    // se arma un solo post con attached_media -- así queda como una sola
    // publicación con carrusel de fotos, no una por foto.
    const mediaFbids: string[] = [];
    for (const url of fotosUrls) {
      const foto = await this.llamar(`${pageId}/photos`, {
        url,
        published: 'false',
        access_token: token,
      });
      if (foto.id) mediaFbids.push(foto.id);
    }

    const post = await this.llamar(`${pageId}/feed`, {
      message: mensaje,
      attached_media: JSON.stringify(mediaFbids.map((id) => ({ media_fbid: id }))),
      access_token: token,
    });
    return post.id ?? '';
  }

  /** Publica en la cuenta de Instagram Business vinculada. Devuelve el ID de la publicación. */
  async publicarEnInstagram(fotosUrls: string[], caption: string): Promise<string> {
    const igUserId = this.igUserId();
    const token = this.pageToken();

    let creationId: string;

    if (fotosUrls.length === 1) {
      const contenedor = await this.llamar(`${igUserId}/media`, {
        image_url: fotosUrls[0],
        caption,
        access_token: token,
      });
      creationId = contenedor.id ?? '';
    } else {
      // Carrusel: un contenedor "hijo" por foto (is_carousel_item), luego un
      // contenedor "padre" tipo CAROUSEL que los agrupa.
      const hijos: string[] = [];
      for (const url of fotosUrls) {
        const item = await this.llamar(`${igUserId}/media`, {
          image_url: url,
          is_carousel_item: 'true',
          access_token: token,
        });
        if (item.id) hijos.push(item.id);
      }
      // Cada hijo debe estar procesado antes de agruparlos en el padre.
      for (const hijo of hijos) {
        await this.esperarContenedorListo(hijo);
      }
      const padre = await this.llamar(`${igUserId}/media`, {
        media_type: 'CAROUSEL',
        children: hijos.join(','),
        caption,
        access_token: token,
      });
      creationId = padre.id ?? '';
    }

    // Esperar a que Instagram termine de procesar antes de publicar.
    await this.esperarContenedorListo(creationId);

    const publicado = await this.llamar(`${igUserId}/media_publish`, {
      creation_id: creationId,
      access_token: token,
    });
    return publicado.id ?? '';
  }
}
