import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AlertasService } from './alertas.service.js';
import { SeveridadAlerta, TipoReglaAlerta, RolUsuario } from '../common/enums/index.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtPayloadUsuario } from '../auth/decorators/current-user.decorator.js';

@Controller('alertas')
export class AlertasController {
  constructor(private readonly alertasService: AlertasService) {}

  @Get()
  listar(
    @CurrentUser() usuario: JwtPayloadUsuario,
    @Query('resuelta') resuelta?: string,
    @Query('severidad') severidad?: SeveridadAlerta,
    @Query('expedienteId') expedienteId?: string,
  ) {
    return this.alertasService.listar(
      {
        resuelta: resuelta === undefined ? undefined : resuelta === 'true',
        severidad,
        expedienteId,
      },
      { id: usuario.sub, rol: usuario.rol as RolUsuario },
    );
  }

  @Patch(':id/vista')
  marcarVista(@Param('id') id: string, @CurrentUser() usuario: JwtPayloadUsuario) {
    return this.alertasService.marcarVista(id, { id: usuario.sub, rol: usuario.rol as RolUsuario });
  }

  // Disparo manual del motor de reglas — útil para pruebas y para un botón
  // de "actualizar alertas ahora" en el dashboard, además del cron
  // automático (ver AlertasScheduler).
  @Post('generar')
  generar() {
    return this.alertasService.generarAlertas();
  }

  @Get('config')
  listarConfig() {
    return this.alertasService.listarConfig();
  }

  // Ajustar sensibilidad de las reglas (ej. días de umbral) es
  // configuración administrativa — sección 14.
  @Patch('config/:tipoRegla')
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.SUPERADMINISTRADOR, RolUsuario.ABOGADO_ADMINISTRADOR)
  actualizarConfig(
    @Param('tipoRegla') tipoRegla: TipoReglaAlerta,
    @Body() cambios: { activa?: boolean; umbralDias?: number; severidadDefault?: SeveridadAlerta },
  ) {
    return this.alertasService.actualizarConfig(tipoRegla, cambios);
  }
}
