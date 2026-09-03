import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from './usuario.entity.js';
import { UsuariosService } from './usuarios.service.js';
import { UsuariosController } from './usuarios.controller.js';
import { HistorialCambiosModule } from '../historial-cambios/historial-cambios.module.js';
import { CifradoService } from '../common/cifrado/cifrado.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Usuario]), HistorialCambiosModule],
  controllers: [UsuariosController],
  providers: [UsuariosService, CifradoService],
  exports: [UsuariosService],
})
export class UsuariosModule {}
