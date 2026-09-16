import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { GastosService } from './gastos.service.js';
import { CreateGastoDto } from './dto/gasto.dto.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { PermisosGuard } from '../auth/guards/permisos.guard.js';
import { Permisos } from '../auth/decorators/permisos.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { ROLES_CON_ACCESO_FACTURACION, Permiso } from '../common/enums/index.js';

@Controller('gastos')
@UseGuards(RolesGuard, PermisosGuard)
@Roles(...ROLES_CON_ACCESO_FACTURACION)
export class GastosController {
  constructor(private readonly gastosService: GastosService) {}

  @Get()
  listar(@Query('expedienteId') expedienteId?: string) {
    return this.gastosService.listar(expedienteId);
  }

  @Post()
  @Permisos(Permiso.FACTURAR)
  crear(@Body() dto: CreateGastoDto, @CurrentUser('sub') usuarioId: string) {
    return this.gastosService.crear(dto, usuarioId);
  }

  @Delete(':id')
  @Permisos(Permiso.FACTURAR)
  eliminar(@Param('id') id: string) {
    return this.gastosService.eliminar(id);
  }
}
