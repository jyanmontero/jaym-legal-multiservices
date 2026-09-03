import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Factura } from '../facturacion/factura.entity.js';
import { ClientesModule } from '../clientes/clientes.module.js';
import { ExpedientesModule } from '../expedientes/expedientes.module.js';
import { BusquedaService } from './busqueda.service.js';
import { BusquedaController } from './busqueda.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Factura]), ClientesModule, ExpedientesModule],
  controllers: [BusquedaController],
  providers: [BusquedaService],
})
export class BusquedaModule {}
