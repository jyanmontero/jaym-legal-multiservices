import { Controller, Post, Body } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AsistenteService } from './asistente.service.js';
import { MensajeAsistenteDto } from './dto/asistente.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';

@Controller('asistente')
export class AsistenteController {
  constructor(private readonly asistenteService: AsistenteService) {}

  // Limite propio (auditoría 14-sep-2026): cada mensaje es una llamada
  // real a la API de Anthropic -- ver misma nota en clientes.controller.ts.
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('mensaje')
  async mensaje(@Body() dto: MensajeAsistenteDto, @CurrentUser('sub') usuarioId: string) {
    const respuesta = await this.asistenteService.procesarMensaje(dto.texto, usuarioId);
    return { respuesta };
  }
}
