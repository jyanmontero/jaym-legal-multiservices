import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { PortalUsuariosAdminService } from './portal-usuarios-admin.service.js';
import { CrearPortalUsuarioDto } from './dto/crear-portal-usuario.dto.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RolUsuario } from '../common/enums/index.js';

/**
 * Gestión (lado staff) de las cuentas de acceso al Portal del Cliente de
 * un cliente concreto -- crear invitación, listar, desactivar/reactivar,
 * reenviar. Restringido a los mismos roles que ya administran clientes.
 */
@Controller('clientes/:clienteId/portal-usuarios')
@UseGuards(RolesGuard)
@Roles(RolUsuario.SUPERADMINISTRADOR, RolUsuario.ABOGADO_ADMINISTRADOR)
export class PortalAdminController {
  constructor(private readonly portalUsuariosAdminService: PortalUsuariosAdminService) {}

  @Get()
  listar(@Param('clienteId') clienteId: string) {
    return this.portalUsuariosAdminService.listarPorCliente(clienteId);
  }

  @Post()
  crear(@Param('clienteId') clienteId: string, @Body() dto: CrearPortalUsuarioDto, @CurrentUser('sub') usuarioId: string) {
    return this.portalUsuariosAdminService.crear(clienteId, dto, usuarioId);
  }

  @Post(':portalUsuarioId/reenviar-invitacion')
  reenviar(@Param('portalUsuarioId') portalUsuarioId: string) {
    return this.portalUsuariosAdminService.reenviarInvitacion(portalUsuarioId);
  }

  @Patch(':portalUsuarioId/activo')
  cambiarActivo(@Param('portalUsuarioId') portalUsuarioId: string, @Body('activo') activo: boolean) {
    return this.portalUsuariosAdminService.cambiarActivo(portalUsuarioId, activo);
  }
}
