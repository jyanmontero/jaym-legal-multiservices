import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgendaEvento } from './agenda-evento.entity.js';
import { AgendaService } from './agenda.service.js';
import { AgendaController } from './agenda.controller.js';
import { GoogleCalendarModule } from '../integraciones/google-calendar/google-calendar.module.js';
import { NotificacionesModule } from '../notificaciones/notificaciones.module.js';
import { UsuariosModule } from '../usuarios/usuarios.module.js';
import { AgendaScheduler } from './agenda.scheduler.js';

@Module({
  imports: [TypeOrmModule.forFeature([AgendaEvento]), GoogleCalendarModule, NotificacionesModule, UsuariosModule],
  controllers: [AgendaController],
  providers: [AgendaService, AgendaScheduler],
  exports: [AgendaService],
})
export class AgendaModule {}
