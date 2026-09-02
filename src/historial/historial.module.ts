import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HistorialExpediente } from './historial-expediente.entity.js';
import { HistorialService } from './historial.service.js';
import { HistorialController } from './historial.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([HistorialExpediente])],
  controllers: [HistorialController],
  providers: [HistorialService],
  exports: [HistorialService],
})
export class HistorialModule {}
