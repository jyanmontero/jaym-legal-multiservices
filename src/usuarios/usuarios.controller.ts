import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { UseGuards } from '@nestjs/common';
import { UsuariosService } from './usuarios.service.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { CreateUsuarioDto, ResetearPasswordDto } from './dto/create-usuario.dto.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolUsuario, EstadoUsuario } from '../common/enums/index.js';

@Controller('usuarios')
@UseGuards(RolesGuard)
@Roles(RolUsuario.SUPERADMINISTRADOR)
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get()
  listar(@Query('pagina') pagina?: string, @Query('porPagina') porPagina?: string) {
    if (pagina !== undefined || porPagina !== undefined) {
      return this.usuariosService.listar({ pagina, porPagina });
    }
    return this.usuariosService.listar();
  }

  // Lista básica para selectores (ej. "Abogado responsable" en
  // Expedientes) -- abierta también a Abogado Administrador, no solo al
  // Superadministrador como el resto de este controlador.
  @Get('basico')
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.SUPERADMINISTRADOR, RolUsuario.ABOGADO_ADMINISTRADOR)
  listarBasico() {
    return this.usuariosService.listarBasico();
  }

  @Post()
  crear(@Body() dto: CreateUsuarioDto) {
    return this.usuariosService.crear(dto);
  }

  @Patch(':id/estado')
  cambiarEstado(
    @Param('id') id: string,
    @Body('estado') estado: EstadoUsuario,
    @CurrentUser('sub') usuarioId: string,
  ) {
    return this.usuariosService.cambiarEstado(id, estado, usuarioId);
  }

  /**
   * Restablece la contraseña de cualquier usuario sin pedir la anterior —
   * solo el Superadministrador puede hacerlo (ya restringido a nivel de
   * clase con @Roles arriba). Uso previsto: el usuario olvidó su clave.
   */
  @Post(':id/resetear-password')
  resetearPassword(
    @Param('id') id: string,
    @Body() dto: ResetearPasswordDto,
    @CurrentUser('sub') usuarioId: string,
  ) {
    return this.usuariosService.resetearPassword(id, dto.nuevaPassword, usuarioId);
  }

  @Get(':id/historial')
  historial(@Param('id') id: string) {
    return this.usuariosService.historial(id);
  }
}
