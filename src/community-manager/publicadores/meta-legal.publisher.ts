import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { pausa, type ResultadoPublicador } from './tipos.js';

interface RespuestaMeta {
  id?: string;
  post_id?: string;
  status_code?: string;
  permalink?: string;
  error?: { message: string; code?: number; error_subcode?: number };
}

/**
 * Publica en la Página de Facebook y en el Instagram de JAYM Legal (NO el
 * Portal Inmobiliario: aquel usa META_PAGE_ID/META_PAGE_ACCESS_TOKEN en
 * marketing/meta-graph.service.ts). Variables de entorno propias:
 *   META_LEGAL_PAGE_ID                       -- ID de la Página de Facebook de JAYM Legal
 *   META_LEGAL_PAGE_ACCESS_TOKEN             -- token de Página (no expira) de esa Página
 *   META_LEGAL_INSTAGRAM_BUSINESS_ACCOUNT_ID -- ID de Instagram Business vinculado a esa Página
 *   META_GRAPH_API_VERSION                   -- opcional, por defecto v21.0
 * Instagram espera a que el contenedor de la foto esté FINISHED antes de
 * publicar (mismo arreglo del error "Media ID is not available").
 */
@Injectable()
export class MetaLegalPublisher {
  private readonly logger = new Logger(MetaLegalPublisher.name);

  constructor(private readonly config: ConfigService) {}

  private base(): string {
    return `https://graph.facebook.com/${this.config.get<string>('META_GRAPH_API_VERSION') || 'v21.0'}`;
  }

  private token(): string {
    return this.config.get<string>('META_LEGAL_PAGE_ACCESS_TOKEN') ?? '';
  }

  facebookConfigurado(): boolean {
    return Boolean(this.config.get<string>('META_LEGAL_PAGE_ID') && this.token());
  }

  instagramConfigurado(): boolean {
    return Boolean(this.config.get<string>('META_LEGAL_INSTAGRAM_BUSINESS_ACCOUNT_ID') && this.token());
  }

  private async post(ruta: string, cuerpo: Record<string, string>): Promise<RespuestaMeta> {
    const respuesta = await fetch(`${this.base()}/${ruta}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(cuerpo).toString(),
    });
    const datos = (await respuesta.json()) as RespuestaMeta;
    if (!respuesta.ok || datos.error) {
      this.logger.error(`Graph API ${ruta} falló: ${JSON.stringify(datos.error ?? datos)}`);
      throw new BadRequestException(`Meta rechazó la publicación: ${datos.error?.message ?? 'error desconocido'}`);
    }
    return datos;
  }

  private async get(ruta: string, campos: string): Promise<RespuestaMeta> {
    const consulta = new URLSearchParams({ fields: campos, access_token: this.token() }).toString();
    const respuesta = await fetch(`${this.base()}/${ruta}?${consulta}`);
    return (await respuesta.json()) as RespuestaMeta;
  }

  async publicarEnFacebook(texto: string, imagenUrl?: string, enlace?: string): Promise<ResultadoPublicador> {
    if (!this.facebookConfigurado()) {
      throw new BadRequestException('Falta configurar META_LEGAL_PAGE_ID y META_LEGAL_PAGE_ACCESS_TOKEN.');
    }
    const pageId = this.config.get<string>('META_LEGAL_PAGE_ID')!;
    const token = this.token();

    let resultado: RespuestaMeta;
    if (imagenUrl) {
      resultado = await this.post(`${pageId}/photos`, { url: imagenUrl, caption: texto, access_token: token });
    } else {
      const cuerpo: Record<string, string> = { message: texto, access_token: token };
      if (enlace) cuerpo.link = enlace;
      resultado = await this.post(`${pageId}/feed`, cuerpo);
    }
    const id = resultado.post_id ?? resultado.id ?? '';
    return { idExterno: id, enlace: id ? `https://www.facebook.com/${id}` : undefined };
  }

  private async esperarContenedor(creationId: string): Promise<void> {
    for (let i = 0; i < 30; i++) {
      const datos = await this.get(creationId, 'status_code');
      if (datos.error) {
        throw new BadRequestException(`Meta no pudo confirmar el estado de la foto: ${datos.error.message}`);
      }
      if (datos.status_code === 'FINISHED') return;
      if (datos.status_code === 'ERROR' || datos.status_code === 'EXPIRED') {
        throw new BadRequestException(
          `Instagram no pudo procesar la imagen (estado ${datos.status_code}). Usa una foto JPG o PNG.`,
        );
      }
      await pausa(3000);
    }
    throw new BadRequestException('Instagram tardó demasiado en procesar la foto. Intenta de nuevo.');
  }

  async publicarEnInstagram(texto: string, imagenUrl?: string): Promise<ResultadoPublicador> {
    if (!this.instagramConfigurado()) {
      throw new BadRequestException(
        'Falta configurar META_LEGAL_INSTAGRAM_BUSINESS_ACCOUNT_ID y META_LEGAL_PAGE_ACCESS_TOKEN.',
      );
    }
    if (!imagenUrl) {
      throw new BadRequestException('Instagram necesita una imagen: sube una foto a la publicación.');
    }
    const igId = this.config.get<string>('META_LEGAL_INSTAGRAM_BUSINESS_ACCOUNT_ID')!;
    const token = this.token();

    const contenedor = await this.post(`${igId}/media`, {
      image_url: imagenUrl,
      caption: texto,
      access_token: token,
    });
    const creationId = contenedor.id ?? '';
    await this.esperarContenedor(creationId);

    const publicado = await this.post(`${igId}/media_publish`, { creation_id: creationId, access_token: token });
    const mediaId = publicado.id ?? '';
    let enlace: string | undefined;
    if (mediaId) {
      const detalle = await this.get(mediaId, 'permalink').catch(() => ({}) as RespuestaMeta);
      enlace = detalle.permalink;
    }
    return { idExterno: mediaId, enlace };
  }
}
