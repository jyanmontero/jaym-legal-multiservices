import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeguimientoExpediente } from './seguimiento-expediente.entity.js';
import { SeguimientoService } from './seguimiento.service.js';
import { SeguimientoController } from './seguimiento.controller.js';
import { Expediente } from '../expedientes/expediente.entity.js';
import { Usuario } from '../usuarios/usuario.entity.js';

@Module({
  // Expediente y Usuario se registran aquí (solo para lectura de sus
  // repositorios, sin importar ExpedientesModule/UsuariosModule) para
  // evitar una dependencia circular entre módulos -- mismo patrón que
  // HistorialModule.
  imports: [TypeOrmModule.forFeature([SeguimientoExpediente, Expediente, Usuario])],
  controllers: [SeguimientoController],
  providers: [SeguimientoService],
  exports: [SeguimientoService],
})
export class SeguimientoModule {}
