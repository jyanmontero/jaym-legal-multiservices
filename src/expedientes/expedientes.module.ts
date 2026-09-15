import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Expediente } from './expediente.entity.js';
import { ExpedientesService } from './expedientes.service.js';
import { ResumenCotizacionService } from './resumen-cotizacion.service.js';
import { ExpedientesController } from './expedientes.controller.js';
import { HistorialModule } from '../historial/historial.module.js';
import { RequisitosModule } from '../requisitos/requisitos.module.js';
import { ClientesModule } from '../clientes/clientes.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Expediente]), HistorialModule, RequisitosModule, ClientesModule],
  controllers: [ExpedientesController],
  providers: [ExpedientesService, ResumenCotizacionService],
  exports: [ExpedientesService],
})
export class ExpedientesModule {}
