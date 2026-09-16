import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { PortalDatosService } from './portal-datos.service.js';
import { PermisosGuard } from '../auth/guards/permisos.guard.js';
import { Permisos } from '../auth/decorators/permisos.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Permiso } from '../common/enums/index.js';
import { IsOptional, IsString, IsUUID } from 'class-validator';

class CrearMensajeStaffDto {
  @IsUUID()
  clienteId: string;

  @IsOptional()
  @IsUUID()
  expedienteId?: string;

  @IsString()
  contenido: string;
}

/**
 * Lado staff del hilo de mensajes del Portal del Cliente -- ver y responder
 * lo que un cliente escribió desde su portal. No confundir con
 * PortalController (ese es el lado del propio cliente).
 */
@Controller('mensajes-portal')
@UseGuards(PermisosGuard)
export class MensajesStaffController {
  constructor(private readonly portalDatosService: PortalDatosService) {}

  @Get()
  @Permisos(Permiso.CONSULTAR)
  listar(@Query('clienteId') clienteId: string, @Query('expedienteId') expedienteId?: string) {
    return this.portalDatosService.listarMensajesStaff(clienteId, expedienteId);
  }

  @Post()
  @Permisos(Permiso.ENVIAR_CORREOS)
  enviar(@Body() dto: CrearMensajeStaffDto, @CurrentUser('sub') usuarioId: string) {
    return this.portalDatosService.enviarMensajeStaff(usuarioId, dto.clienteId, dto.expedienteId, dto.contenido);
  }
}
