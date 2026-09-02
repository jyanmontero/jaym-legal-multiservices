import { Controller, Get, Param } from '@nestjs/common';
import { HistorialService } from './historial.service.js';

@Controller('expedientes/:expedienteId/historial')
export class HistorialController {
  constructor(private readonly historialService: HistorialService) {}

  @Get()
  listar(@Param('expedienteId') expedienteId: string) {
    return this.historialService.listarPorExpediente(expedienteId);
  }

  // La restauración de una versión vive en ExpedientesController
  // (POST /expedientes/:id/restaurar/:historialId) porque requiere permiso
  // de Superadministrador — ver guard RolesGuard en ese módulo.
}
