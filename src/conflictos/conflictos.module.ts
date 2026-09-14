import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cliente } from '../clientes/cliente.entity.js';
import { Expediente } from '../expedientes/expediente.entity.js';
import { ConflictosService } from './conflictos.service.js';
import { ConflictosController } from './conflictos.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Cliente, Expediente])],
  controllers: [ConflictosController],
  providers: [ConflictosService],
})
export class ConflictosModule {}
