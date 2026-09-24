import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ColaboradoresAdminService } from './colaboradores-admin.service.js';
import { CrearColaboradorDto, ActualizarColaboradorDto } from './dto/crear-colaborador.dto.js';
import { AsignarExpedienteColaboradorDto } from './dto/asignar-expediente.dto.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RolUsuario } from '../common/enums/index.js';

/**
 * Gestión (lado staff) de las cuentas del Portal de Colaboradores -- crear,
 * listar, activar/desactivar, y asignar/desasignar expedientes. Restringido
 * a los mismos roles que administran al personal interno (Usuarios), porque
 * dar de alta un colaborador externo es una decisión de la misma naturaleza.
 */
@Controller('colaboradores')
@UseGuards(RolesGuard)
@Roles(RolUsuario.SUPERADMINISTRADOR, RolUsuario.ABOGADO_ADMINISTRADOR)
export class ColaboradoresAdminController {
  constructor(private readonly colaboradoresAdminService: ColaboradoresAdminService) {}

  @Get()
  listar() {
    return this.colaboradoresAdminService.listar();
  }

  @Post()
  crear(@Body() dto: CrearColaboradorDto, @CurrentUser('sub') usuarioId: string) {
    return this.colaboradoresAdminService.crear(dto, usuarioId);
  }

  @Patch(':id')
  actualizar(@Param('id') id: string, @Body() dto: ActualizarColaboradorDto) {
    return this.colaboradoresAdminService.actualizar(id, dto);
  }

  @Post(':id/reenviar-invitacion')
  reenviar(@Param('id') id: string) {
    return this.colaboradoresAdminService.reenviarInvitacion(id);
  }

  @Patch(':id/activo')
  cambiarActivo(@Param('id') id: string, @Body('activo') activo: boolean) {
    return this.colaboradoresAdminService.cambiarActivo(id, activo);
  }

  @Get(':id/expedientes')
  listarAsignaciones(@Param('id') id: string) {
    return this.colaboradoresAdminService.listarAsignaciones(id);
  }

  @Post(':id/expedientes')
  asignarExpediente(
    @Param('id') id: string,
    @Body() dto: AsignarExpedienteColaboradorDto,
    @CurrentUser('sub') usuarioId: string,
  ) {
    return this.colaboradoresAdminService.asignarExpediente(id, dto, usuarioId);
  }

  @Delete(':id/expedientes/:expedienteId')
  desasignarExpediente(@Param('id') id: string, @Param('expedienteId') expedienteId: string) {
    return this.colaboradoresAdminService.desasignarExpediente(id, expedienteId);
  }
}
