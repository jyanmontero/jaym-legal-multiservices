import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { pausa, type ResultadoPublicador } from './tipos.js';

interface RespuestaThreads {
  id?: string;
  status?: string;
  permalink?: string;
  error?: { message: string };
}

/**
 * Publica en Threads (@jaym_group_multiservices) con la API oficial de
 * Threads (graph.threads.net). Variables de entorno:
 *   THREADS_USER_ID       -- ID numérico del usuario de Threads
 *   THREADS_ACCESS_TOKEN  -- token de acceso de larga duración con threads_content_publish
 */
@Injectable()
export class ThreadsPublisher {
  private readonly logger = new Logger(ThreadsPublisher.name);
  private readonly base = 'https://graph.threads.net/v1.0';

  constructor(private readonly config: ConfigService) {}

  configurado(): boolean {
    return Boolean(this.config.get<string>('THREADS_USER_ID') && this.config.get<string>('THREADS_ACCESS_TOKEN'));
  }

  private token(): string {
    return this.config.get<string>('THREADS_ACCESS_TOKEN') ?? '';
  }

  private async post(ruta: string, cuerpo: Record<string, string>): Promise<RespuestaThreads> {
    const respuesta = await fetch(`${this.base}/${ruta}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ ...cuerpo, access_token: this.token() }).toString(),
    });
    const datos = (await respuesta.json()) as RespuestaThreads;
    if (!respuesta.ok || datos.error) {
      this.logger.error(`Threads ${ruta} falló: ${JSON.stringify(datos.error ?? datos)}`);
      throw new BadRequestException(`Threads rechazó la publicación: ${datos.error?.message ?? 'error desconocido'}`);
    }
    return datos;
  }

  private async get(ruta: string, campos: string): Promise<RespuestaThreads> {
    const consulta = new URLSearchParams({ fields: campos, access_token: this.token() }).toString();
    const respuesta = await fetch(`${this.base}/${ruta}?${consulta}`);
    return (await respuesta.json()) as RespuestaThreads;
  }

  async publicar(texto: string, imagenUrl?: string): Promise<ResultadoPublicador> {
    if (!this.configurado()) {
      throw new BadRequestException('Falta configurar THREADS_USER_ID y THREADS_ACCESS_TOKEN.');
    }
    const userId = this.config.get<string>('THREADS_USER_ID')!;

    const cuerpo: Record<string, string> = imagenUrl
      ? { media_type: 'IMAGE', image_url: imagenUrl, text: texto }
      : { media_type: 'TEXT', text: texto };
    const contenedor = await this.post(`${userId}/threads`, cuerpo);
    const creationId = contenedor.id ?? '';

    // Threads procesa el contenedor de forma asíncrona: se espera a FINISHED.
    let listo = false;
    for (let i = 0; i < 20; i++) {
      const estado = await this.get(creationId, 'status');
      if (estado.status === 'FINISHED') {
        listo = true;
        break;
      }
      if (estado.status === 'ERROR' || estado.status === 'EXPIRED') {
        throw new BadRequestException(`Threads no pudo procesar la publicación (estado ${estado.status}).`);
      }
      await pausa(3000);
    }
    if (!listo) throw new BadRequestException('Threads tardó demasiado en procesar la publicación.');

    const publicado = await this.post(`${userId}/threads_publish`, { creation_id: creationId });
    const mediaId = publicado.id ?? '';
    let enlace: string | undefined;
    if (mediaId) {
      const detalle = await this.get(mediaId, 'permalink').catch(() => ({}) as RespuestaThreads);
      enlace = detalle.permalink;
    }
    return { idExterno: mediaId, enlace };
  }
}
