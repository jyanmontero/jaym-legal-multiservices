import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriaFinanciera } from './categoria-financiera.entity.js';
import { MovimientoFinanciero } from './movimiento-financiero.entity.js';
import { Pago } from '../facturacion/pago.entity.js';
import { Factura } from '../facturacion/factura.entity.js';
import { FinanzasService } from './finanzas.service.js';
import { FinanzasController } from './finanzas.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([CategoriaFinanciera, MovimientoFinanciero, Pago, Factura])],
  controllers: [FinanzasController],
  providers: [FinanzasService],
  exports: [FinanzasService],
})
export class FinanzasModule {}
