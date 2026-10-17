import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Compra } from './compra.entity.js';
import { CompraHistorial } from './compra-historial.entity.js';
import { Factura } from '../facturacion/factura.entity.js';
import { Pago } from '../facturacion/pago.entity.js';
import { Cliente } from '../clientes/cliente.entity.js';
import { DocumentosModule } from '../documentos/documentos.module.js';
import { ComprasService } from './compras.service.js';
import { ExtraccionFacturaGastoService } from './extraccion-factura-gasto.service.js';
import { ReporteImpuestosService } from './reporte-impuestos.service.js';
import { ComprasController, ImpuestosController } from './compras.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Compra, CompraHistorial, Factura, Pago, Cliente]), DocumentosModule],
  controllers: [ComprasController, ImpuestosController],
  providers: [ComprasService, ExtraccionFacturaGastoService, ReporteImpuestosService],
  exports: [ComprasService, ReporteImpuestosService],
})
export class ComprasModule {}
