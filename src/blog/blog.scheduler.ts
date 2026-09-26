import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BlogService } from './blog.service.js';

/**
 * Publicación automática diaria del blog de jaymlegalmultiservices.com --
 * esto es lo que responde al pedido de Joseph de "programar publicación de
 * marketing por días o semanas para que diario suba sin mi intervención".
 *
 * Todos los días a las 8:00am (hora del servidor) revisa qué blogs están
 * "programado" con fecha ya llegada (hoy o antes -- por si el servidor
 * estuvo caído un día y se necesita ponerse al día) y los publica solos en
 * WordPress. Si algo falla (por ejemplo, credenciales de WordPress no
 * configuradas, o el sitio caído en ese momento), el blog queda en estado
 * "fallido" con el motivo, en vez de reintentar en silencio para siempre --
 * Joseph lo ve en la lista y decide si reprogramarlo.
 */
@Injectable()
export class BlogScheduler {
  private readonly logger = new Logger(BlogScheduler.name);

  constructor(private readonly blogService: BlogService) {}

  @Cron('0 8 * * *') // Todos los días a las 8:00am
  async publicarProgramadosDeHoy(): Promise<void> {
    if (!this.blogService.credencialesConfiguradas()) {
      return;
    }

    const hoyIso = new Date().toISOString().slice(0, 10);
    const pendientes = await this.blogService.listarPendientesDeHoy(hoyIso);
    if (pendientes.length === 0) return;

    this.logger.log(`Publicando ${pendientes.length} blog(s) programado(s) para hoy o antes...`);
    for (const post of pendientes) {
      await this.blogService.publicarSilencioso(post);
    }
  }
}
