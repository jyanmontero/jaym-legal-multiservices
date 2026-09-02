import { Controller, Get } from '@nestjs/common';
import { GoogleCalendarService } from './google-calendar.service.js';

@Controller('integraciones/google-calendar')
export class GoogleCalendarController {
  constructor(private readonly googleCalendarService: GoogleCalendarService) {}

  // Cualquier usuario con sesión puede ver si está conectado (se usa para
  // mostrar el estado en la Agenda) — no expone ningún dato sensible.
  @Get('estado')
  estado() {
    return { conectado: this.googleCalendarService.estaConfigurado() };
  }
}
