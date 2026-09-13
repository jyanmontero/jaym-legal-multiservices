import { Controller, Post, Body } from '@nestjs/common';
import { AsistenteService } from './asistente.service.js';
import { MensajeAsistenteDto } from './dto/asistente.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';

@Controller('asistente')
export class AsistenteController {
  constructor(private readonly asistenteService: AsistenteService) {}

  @Post('mensaje')
  async mensaje(@Body() dto: MensajeAsistenteDto, @CurrentUser('sub') usuarioId: string) {
    const respuesta = await this.asistenteService.procesarMensaje(dto.texto, usuarioId);
    return { respuesta };
  }
}
