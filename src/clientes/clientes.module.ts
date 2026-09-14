import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cliente } from './cliente.entity.js';
import { ClientesService } from './clientes.service.js';
import { ExtraccionIdentidadService } from './extraccion-identidad.service.js';
import { ClientesController } from './clientes.controller.js';
import { HistorialCambiosModule } from '../historial-cambios/historial-cambios.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Cliente]), HistorialCambiosModule],
  controllers: [ClientesController],
  providers: [ClientesService, ExtraccionIdentidadService],
  exports: [ClientesService],
})
export class ClientesModule {}
