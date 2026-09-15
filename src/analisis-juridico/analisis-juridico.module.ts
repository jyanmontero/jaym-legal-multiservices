import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Expediente } from '../expedientes/expediente.entity.js';
import { AnalisisJuridicoService } from './analisis-juridico.service.js';
import { AnalisisJuridicoController } from './analisis-juridico.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Expediente])],
  controllers: [AnalisisJuridicoController],
  providers: [AnalisisJuridicoService],
})
export class AnalisisJuridicoModule {}
