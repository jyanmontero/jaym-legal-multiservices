import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HistorialCambio } from './historial-cambio.entity.js';
import { Usuario } from '../usuarios/usuario.entity.js';
import { HistorialCambiosService } from './historial-cambios.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([HistorialCambio, Usuario])],
  providers: [HistorialCambiosService],
  exports: [HistorialCambiosService],
})
export class HistorialCambiosModule {}
