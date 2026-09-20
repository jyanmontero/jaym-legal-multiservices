import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { FinanzasService } from './finanzas.service.js';
import { CreateCategoriaFinancieraDto, UpdateCategoriaFinancieraDto } from './dto/categoria-financiera.dto.js';
import { CreateMovimientoFinancieroDto } from './dto/movimiento-financiero.dto.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { PermisosGuard } from '../auth/guards/permisos.guard.js';
import { Permisos } from '../auth/decorators/permisos.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { ROLES_CON_ACCESO_FACTURACION, Permiso, TipoMovimientoFinanciero } from '../common/enums/index.js';

/**
 * Control de Gastos e Ingresos de la firma -- mismos roles que ya tienen
 * acceso a Facturación (superadministrador, abogado administrador,
 * facturación y contabilidad), porque es la misma función administrativa.
 */
@Controller('finanzas')
@UseGuards(RolesGuard, PermisosGuard)
@Roles(...ROLES_CON_ACCESO_FACTURACION)
export class FinanzasController {
  constructor(private readonly finanzasService: FinanzasService) {}

  @Get('categorias')
  listarCategorias(@Query('tipo') tipo?: TipoMovimientoFinanciero, @Query('incluirInactivas') incluirInactivas?: string) {
    return this.finanzasService.listarCategorias(tipo, incluirInactivas === 'true');
  }

  @Post('categorias')
  @Permisos(Permiso.FACTURAR)
  crearCategoria(@Body() dto: CreateCategoriaFinancieraDto) {
    return this.finanzasService.crearCategoria(dto);
  }

  @Patch('categorias/:id')
  @Permisos(Permiso.FACTURAR)
  actualizarCategoria(@Param('id') id: string, @Body() dto: UpdateCategoriaFinancieraDto) {
    return this.finanzasService.actualizarCategoria(id, dto);
  }

  @Get('movimientos')
  listarMovimientos(
    @Query('tipo') tipo?: TipoMovimientoFinanciero,
    @Query('categoriaId') categoriaId?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.finanzasService.listarMovimientos({ tipo, categoriaId, desde, hasta });
  }

  @Post('movimientos')
  @Permisos(Permiso.FACTURAR)
  crearMovimiento(@Body() dto: CreateMovimientoFinancieroDto, @CurrentUser('sub') usuarioId: string) {
    return this.finanzasService.crearMovimiento(dto, usuarioId);
  }

  @Delete('movimientos/:id')
  @Permisos(Permiso.FACTURAR)
  eliminarMovimiento(@Param('id') id: string) {
    return this.finanzasService.eliminarMovimiento(id);
  }

  @Get('panel')
  panel(@Query('anio') anio?: string, @Query('mes') mes?: string) {
    return this.finanzasService.panel(anio ? Number(anio) : undefined, mes ? Number(mes) : undefined);
  }
}
