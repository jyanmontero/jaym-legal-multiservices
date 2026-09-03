import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Alerta } from './alerta.entity.js';
import { AlertaReglaConfig } from './alerta-regla-config.entity.js';
import { AlertasService } from './alertas.service.js';
import { AlertasController } from './alertas.controller.js';
import { AlertasScheduler } from './alertas.scheduler.js';
import { Expediente } from '../expedientes/expediente.entity.js';
import { Documento } from '../documentos/documento.entity.js';
import { ExpedienteRequisito } from '../requisitos/expediente-requisito.entity.js';
import { AgendaEvento } from '../agenda/agenda-evento.entity.js';
import { Factura } from '../facturacion/factura.entity.js';
import { NotificacionesModule } from '../notificaciones/notificaciones.module.js';

@Module({
  imports: [
    // Solo se registran las entidades para poder inyectar sus repositorios
    // de lectura — Alertas no expone endpoints de escritura sobre ellas,
    // así que no hace falta importar los módulos completos.
    TypeOrmModule.forFeature([
      Alerta,
      AlertaReglaConfig,
      Expediente,
      Documento,
      ExpedienteRequisito,
      AgendaEvento,
      Factura,
    ]),
    // Para que AlertasScheduler pueda inyectar CorreoService y enviar avisos.
    NotificacionesModule,
  ],
  controllers: [AlertasController],
  providers: [AlertasService, AlertasScheduler],
  exports: [AlertasService],
})
export class AlertasModule {}
