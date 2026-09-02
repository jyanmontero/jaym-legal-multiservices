import { Module } from '@nestjs/common';
import { AsistenteService } from './asistente.service.js';
import { AsistenteController } from './asistente.controller.js';
import { AgendaModule } from '../agenda/agenda.module.js';
import { ClientesModule } from '../clientes/clientes.module.js';

@Module({
  imports: [AgendaModule, ClientesModule],
  controllers: [AsistenteController],
  providers: [AsistenteService],
})
export class AsistenteModule {}
