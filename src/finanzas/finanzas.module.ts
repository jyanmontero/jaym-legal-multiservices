import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriaFinanciera } from './categoria-financiera.entity.js';
import { MovimientoFinanciero } from './movimiento-financiero.entity.js';
import { FinanzasService } from './finanzas.service.js';
import { FinanzasController } from './finanzas.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([CategoriaFinanciera, MovimientoFinanciero])],
  controllers: [FinanzasController],
  providers: [FinanzasService],
  exports: [FinanzasService],
})
export class FinanzasModule {}
