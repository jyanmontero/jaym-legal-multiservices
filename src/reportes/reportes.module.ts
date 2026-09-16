import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Expediente } from '../expedientes/expediente.entity.js';
import { Cliente } from '../clientes/cliente.entity.js';
import { Factura } from '../facturacion/factura.entity.js';
import { Pago } from '../facturacion/pago.entity.js';
import { AgendaEvento } from '../agenda/agenda-evento.entity.js';
import { HistorialExpediente } from '../historial/historial-expediente.entity.js';
import { SeguimientoExpediente } from '../seguimiento/seguimiento-expediente.entity.js';
import { HistorialCambio } from '../historial-cambios/historial-cambio.entity.js';
import { Usuario } from '../usuarios/usuario.entity.js';
import { Documento } from '../documentos/documento.entity.js';
import { ReportesService } from './reportes.service.js';
import { ReportesController } from './reportes.controller.js';
import { ReportesScheduler } from './reportes.scheduler.js';
import { RequisitosModule } from '../requisitos/requisitos.module.js';
import { FacturacionModule } from '../facturacion/facturacion.module.js';
import { NotificacionesModule } from '../notificaciones/notificaciones.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Expediente,
      Cliente,
      Factura,
      Pago,
      AgendaEvento,
      HistorialExpediente,
      SeguimientoExpediente,
      HistorialCambio,
      Usuario,
      Documento,
    ]),
    RequisitosModule,
    FacturacionModule,
    NotificacionesModule,
  ],
  controllers: [ReportesController],
  providers: [ReportesService, ReportesScheduler],
  exports: [ReportesService],
})
export class ReportesModule {}
