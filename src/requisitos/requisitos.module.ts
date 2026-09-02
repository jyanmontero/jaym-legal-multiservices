import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequisitoPlantilla } from './requisito-plantilla.entity.js';
import { ExpedienteRequisito } from './expediente-requisito.entity.js';
import { RequisitosPlantillaService } from './requisitos-plantilla.service.js';
import { ExpedienteRequisitosService } from './expediente-requisitos.service.js';
import { RequisitosPlantillaController } from './requisitos-plantilla.controller.js';
import { ExpedienteRequisitosController } from './expediente-requisitos.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([RequisitoPlantilla, ExpedienteRequisito])],
  controllers: [RequisitosPlantillaController, ExpedienteRequisitosController],
  providers: [RequisitosPlantillaService, ExpedienteRequisitosService],
  // Se exporta para que ExpedientesModule pueda generar el checklist
  // automáticamente al crear un expediente y calcular la advertencia de
  // depósito al actualizar su estado.
  exports: [ExpedienteRequisitosService],
})
export class RequisitosModule {}
