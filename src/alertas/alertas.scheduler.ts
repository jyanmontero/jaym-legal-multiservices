import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AlertasService } from './alertas.service.js';

@Injectable()
export class AlertasScheduler {
  private readonly logger = new Logger(AlertasScheduler.name);

  constructor(private readonly alertasService: AlertasService) {}

  // Corre cada hora — suficiente para un despacho de este tamaño (1 a 5
  // usuarios); se puede ajustar sin tocar el motor de reglas en sí.
  @Cron(CronExpression.EVERY_HOUR)
  async ejecutar() {
    this.logger.log('Ejecutando motor de alertas programado...');
    await this.alertasService.generarAlertas();
  }
}
