import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgendaEvento } from './agenda-evento.entity.js';
import { AgendaService } from './agenda.service.js';
import { AgendaController } from './agenda.controller.js';
import { GoogleCalendarModule } from '../integraciones/google-calendar/google-calendar.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([AgendaEvento]), GoogleCalendarModule],
  controllers: [AgendaController],
  providers: [AgendaService],
  exports: [AgendaService],
})
export class AgendaModule {}
