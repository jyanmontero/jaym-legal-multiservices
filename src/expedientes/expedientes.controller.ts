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
import type { JwtPayloadUsuario } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { RolUsuario } from '../common/enums/index.js';

@Controller('expedientes')
export class ExpedientesController {
  constructor(private readonly expedientesService: ExpedientesService) {}

  @Get()
  listar(
    @CurrentUser() usuario: JwtPayloadUsuario,
    @Query('estado') estado?: string,
    @Query('materia') materia?: string,
    @Query('clienteId') clienteId?: string,
    @Query('q') q?: string,
    @Query('pagina') pagina?: string,
    @Query('porPagina') porPagina?: string,
  ) {
    const usuarioActual = { id: usuario.sub, rol: usuario.rol as RolUsuario };
    // Paginación opcional -- sin pagina/porPagina en la query, se devuelve
    // el arreglo completo como siempre (ver ExpedientesService.listar()).
    if (pagina !== undefined || porPagina !== undefined) {
      return this.expedientesService.listar({ estado, materia, clienteId, q }, usuarioActual, {
        pagina,
        porPagina,
      });
    }
    return this.expedientesService.listar({ estado, materia, clienteId, q }, usuarioActual);
  }

  @Get(':id')
  obtener(@Param('id') id: string, @CurrentUser() usuario: JwtPayloadUsuario) {
    return this.expedientesService.obtenerPorId(id, { id: usuario.sub, rol: usuario.rol as RolUsuario });
  }

  @Post()
  crear(@Body() dto: CreateExpedienteDto, @CurrentUser('sub') usuarioId: string) {
    return this.expedientesService.crear(dto, usuarioId);
  }

  @Patch(':id')
  actualizar(
    @Param('id') id: string,
    @Body() dto: UpdateExpedienteDto,
    @CurrentUser() usuario: JwtPayloadUsuario,
    @Ip() ip: string,
  ) {
    return this.expedientesService.actualizar(id, dto, usuario.sub, ip, {
      id: usuario.sub,
      rol: usuario.rol as RolUsuario,
    });
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
