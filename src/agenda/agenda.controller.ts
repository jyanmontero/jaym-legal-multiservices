import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { AgendaService } from './agenda.service.js';
import { CrearEventoAgendaDto, ActualizarEventoAgendaDto } from './dto/agenda.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtPayloadUsuario } from '../auth/decorators/current-user.decorator.js';
import { RolUsuario } from '../common/enums/index.js';

@Controller('agenda')
export class AgendaController {
  constructor(private readonly agendaService: AgendaService) {}

  @Get()
  listar(
    @CurrentUser() usuario: JwtPayloadUsuario,
    @Query('expedienteId') expedienteId?: string,
    @Query('responsableId') responsableId?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('estado') estado?: string,
  ) {
    return this.agendaService.listar(
      { expedienteId, responsableId, desde, hasta, estado },
      { id: usuario.sub, rol: usuario.rol as RolUsuario },
    );
  }

  @Get(':id')
  obtener(@Param('id') id: string, @CurrentUser() usuario: JwtPayloadUsuario) {
    return this.agendaService.obtenerPorId(id, { id: usuario.sub, rol: usuario.rol as RolUsuario });
  }

  @Post()
  crear(@Body() dto: CrearEventoAgendaDto, @CurrentUser('sub') usuarioId: string) {
    return this.agendaService.crear(dto, usuarioId);
  }

  @Patch(':id')
  actualizar(
    @Param('id') id: string,
    @Body() dto: ActualizarEventoAgendaDto,
    @CurrentUser() usuario: JwtPayloadUsuario,
  ) {
    return this.agendaService.actualizar(id, dto, { id: usuario.sub, rol: usuario.rol as RolUsuario });
  }
}
