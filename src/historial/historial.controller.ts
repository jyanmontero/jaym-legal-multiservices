import { Controller, ForbiddenException, Get, NotFoundException, Param } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HistorialService } from './historial.service.js';
import { Expediente } from '../expedientes/expediente.entity.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtPayloadUsuario } from '../auth/decorators/current-user.decorator.js';
import { RolUsuario, ROLES_CON_VISIBILIDAD_TOTAL_EXPEDIENTES } from '../common/enums/index.js';

@Controller('expedientes/:expedienteId/historial')
export class HistorialController {
  constructor(
    private readonly historialService: HistorialService,
    // Inyectado directamente (en vez de importar ExpedientesModule) para
    // evitar una dependencia circular -- ver comentario en HistorialModule.
    // Duplica la regla de ExpedientesService.verificarVisibilidad(): sin
    // visibilidad total, solo el abogado responsable (o nadie, si el
    // expediente no tiene responsable) puede ver su historial de cambios.
    @InjectRepository(Expediente) private readonly expedienteRepo: Repository<Expediente>,
  ) {}

  @Get()
  async listar(@Param('expedienteId') expedienteId: string, @CurrentUser() usuario: JwtPayloadUsuario) {
    const rol = usuario.rol as RolUsuario;
    if (!ROLES_CON_VISIBILIDAD_TOTAL_EXPEDIENTES.includes(rol)) {
      const expediente = await this.expedienteRepo.findOne({ where: { id: expedienteId } });
      if (!expediente) throw new NotFoundException('Expediente no encontrado');
      if (expediente.abogadoResponsableId && expediente.abogadoResponsableId !== usuario.sub) {
        throw new ForbiddenException('Este expediente está asignado a otro abogado responsable.');
      }
    }
    return this.historialService.listarPorExpediente(expedienteId);
  }

  // La restauración de una versión vive en ExpedientesController
  // (POST /expedientes/:id/restaurar/:historialId) porque requiere permiso
  // de Superadministrador — ver guard RolesGuard en ese módulo.
}
