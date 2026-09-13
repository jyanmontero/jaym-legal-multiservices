import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgendaEvento } from '../../agenda/agenda-evento.entity.js';
import { UsuariosModule } from '../../usuarios/usuarios.module.js';
import { GoogleCalendarService } from './google-calendar.service.js';
import { GoogleCalendarController } from './google-calendar.controller.js';
import { GoogleCalendarScheduler } from './google-calendar.scheduler.js';

@Module({
  imports: [TypeOrmModule.forFeature([AgendaEvento]), UsuariosModule],
  controllers: [GoogleCalendarController],
  providers: [GoogleCalendarService, GoogleCalendarScheduler],
  exports: [GoogleCalendarService],
})
export class GoogleCalendarModule {}
