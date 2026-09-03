import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Ip,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ExpedientesService } from './expedientes.service.js';
import { CreateExpedienteDto, UpdateExpedienteDto } from './dto/expediente.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { RolUsuario } from '../common/enums/index.js';

@Controller('expedientes')
export class ExpedientesController {
  constructor(private readonly expedientesService: ExpedientesService) {}

  @Get()
  listar(
    @Query('estado') estado?: string,
    @Query('materia') materia?: string,
    @Query('clienteId') clienteId?: string,
  ) {
    return this.expedientesService.listar({ estado, materia, clienteId });
  }

  @Get(':id')
  obtener(@Param('id') id: string) {
    return this.expedientesService.obtenerPorId(id);
  }

  @Post()
  crear(@Body() dto: CreateExpedienteDto, @CurrentUser('sub') usuarioId: string) {
    return this.expedientesService.crear(dto, usuarioId);
  }

  @Patch(':id')
  actualizar(
    @Param('id') id: string,
    @Body() dto: UpdateExpedienteDto,
    @CurrentUser('sub') usuarioId: string,
    @Ip() ip: string,
  ) {
    return this.expedientesService.actualizar(id, dto, usuarioId, ip);
  }

  // Restringido a Superadministrador -- pensado para corregir un expediente
  // mal instrumentado (duplicado, creado por error), no como flujo normal.
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.SUPERADMINISTRADOR)
  eliminar(@Param('id') id: string) {
    return this.expedientesService.eliminar(id);
  }

  // Restringido a Superadministrador — sección 7 del requerimiento: solo
  // ese rol puede restaurar una versión anterior de un expediente.
  @Post(':id/restaurar/:historialId')
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.SUPERADMINISTRADOR)
  restaurar(
    @Param('id') id: string,
    @Param('historialId') historialId: string,
    @CurrentUser('sub') usuarioId: string,
  ) {
    return this.expedientesService.restaurarVersion(id, historialId, usuarioId, true);
  }
}
