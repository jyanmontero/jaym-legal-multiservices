import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AsistenteService } from './asistente.service.js';
import { AsistenteController } from './asistente.controller.js';
import { AgendaModule } from '../agenda/agenda.module.js';
import { ClientesModule } from '../clientes/clientes.module.js';
import { FacturacionModule } from '../facturacion/facturacion.module.js';
import { Expediente } from '../expedientes/expediente.entity.js';

@Module({
  imports: [AgendaModule, ClientesModule, FacturacionModule, TypeOrmModule.forFeature([Expediente])],
  controllers: [AsistenteController],
  providers: [AsistenteService],
})
export class AsistenteModule {}
