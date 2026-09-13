import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Expediente } from './expediente.entity.js';
import { ExpedientesService } from './expedientes.service.js';
import { ExpedientesController } from './expedientes.controller.js';
import { HistorialModule } from '../historial/historial.module.js';
import { RequisitosModule } from '../requisitos/requisitos.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Expediente]), HistorialModule, RequisitosModule],
  controllers: [ExpedientesController],
  providers: [ExpedientesService],
  exports: [ExpedientesService],
})
export class ExpedientesModule {}
