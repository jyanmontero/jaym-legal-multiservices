import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cliente } from '../../clientes/cliente.entity.js';
import { Expediente } from '../../expedientes/expediente.entity.js';
import { HubSpotService } from './hubspot.service.js';
import { HubSpotController } from './hubspot.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Cliente, Expediente])],
  controllers: [HubSpotController],
  providers: [HubSpotService],
  exports: [HubSpotService],
})
export class HubSpotModule {}
