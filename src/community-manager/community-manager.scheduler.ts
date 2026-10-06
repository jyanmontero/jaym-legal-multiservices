import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CommunityManagerService } from './community-manager.service.js';

/**
 * Cada 10 minutos publica las publicaciones YA APROBADAS (estado
 * "programada") cuya hora llegó. Las que Joseph no aprobó nunca se
 * publican. Si el servidor estuvo dormido, las vencidas salen en cuanto
 * despierta.
 */
@Injectable()
export class CommunityManagerScheduler {
  private readonly logger = new Logger(CommunityManagerScheduler.name);

  constructor(private readonly servicio: CommunityManagerService) {}

  @Cron('*/10 * * * *')
  async publicarProgramadas(): Promise<void> {
    const n = await this.servicio.publicarVencidas();
    if (n > 0) this.logger.log(`Community Manager: ${n} publicación(es) programada(s) procesada(s).`);
  }
}
