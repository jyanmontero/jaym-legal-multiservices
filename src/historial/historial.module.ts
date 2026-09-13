import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HistorialExpediente } from './historial-expediente.entity.js';
import { HistorialService } from './historial.service.js';
import { HistorialController } from './historial.controller.js';
import { Expediente } from '../expedientes/expediente.entity.js';

@Module({
  // Expediente se registra aquí (solo para lectura del repositorio, no se
  // importa ExpedientesModule) porque ExpedientesModule ya importa
  // HistorialModule -- importarlo de vuelta crearía una dependencia
  // circular entre módulos. El controlador duplica la regla de
  // visibilidad de ExpedientesService.verificarVisibilidad() directamente
  // contra este repositorio -- ver comentario en HistorialController.
  imports: [TypeOrmModule.forFeature([HistorialExpediente, Expediente])],
  controllers: [HistorialController],
  providers: [HistorialService],
  exports: [HistorialService],
})
export class HistorialModule {}
