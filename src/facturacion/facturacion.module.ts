import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cotizacion } from './cotizacion.entity.js';
import { Factura } from './factura.entity.js';
import { Pago } from './pago.entity.js';
import { Gasto } from './gasto.entity.js';
import { ComunicacionCobro } from './comunicacion-cobro.entity.js';
import { Cliente } from '../clientes/cliente.entity.js';
import { Expediente } from '../expedientes/expediente.entity.js';
import { FacturacionService } from './facturacion.service.js';
import { GastosService } from './gastos.service.js';
import { PdfService } from './pdf/pdf.service.js';
import { CobrosService } from './cobros.service.js';
import { CobrosController } from './cobros.controller.js';
import { NotificacionesModule } from '../notificaciones/notificaciones.module.js';
import {
  CotizacionesController,
  FacturasController,
  FacturacionController,
} from './facturacion.controller.js';
import { GastosController } from './gastos.controller.js';
import { HistorialCambiosModule } from '../historial-cambios/historial-cambios.module.js';
import { ClientesModule } from '../clientes/clientes.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Cotizacion, Factura, Pago, Gasto, ComunicacionCobro, Cliente, Expediente]),
    HistorialCambiosModule,
    ClientesModule,
    NotificacionesModule,
  ],
  controllers: [CotizacionesController, FacturasController, FacturacionController, GastosController, CobrosController],
  providers: [FacturacionService, GastosService, PdfService, CobrosService],
  exports: [FacturacionService, GastosService, PdfService],
})
export class FacturacionModule {}
