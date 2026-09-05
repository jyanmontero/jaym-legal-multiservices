import { Body, Controller, ForbiddenException, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SeguimientoService } from './seguimiento.service.js';
import { CrearSeguimientoDto } from './dto/seguimiento.dto.js';
import { Expediente } from '../expedientes/expediente.entity.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtPayloadUsuario } from '../auth/decorators/current-user.decorator.js';
import { RolUsuario, ROLES_CON_VISIBILIDAD_TOTAL_EXPEDIENTES } from '../common/enums/index.js';

@Controller('expedientes/:expedienteId/seguimiento')
export class SeguimientoController {
  constructor(
    private readonly seguimientoService: SeguimientoService,
    // Inyectado directamente (no se importa ExpedientesModule) para evitar
    // una dependencia circular -- mismo patrón que HistorialController.
    @InjectRepository(Expediente) private readonly expedienteRepo: Repository<Expediente>,
  ) {}

  private async verificarAcceso(expedienteId: string, usuario: JwtPayloadUsuario): Promise<void> {
    const rol = usuario.rol as RolUsuario;
    if (ROLES_CON_VISIBILIDAD_TOTAL_EXPEDIENTES.includes(rol)) return;
    const expediente = await this.expedienteRepo.findOne({ where: { id: expedienteId } });
    if (!expediente) throw new NotFoundException('Expediente no encontrado');
    if (expediente.abogadoResponsableId && expediente.abogadoResponsableId !== usuario.sub) {
      throw new ForbiddenException('Este expediente está asignado a otro abogado responsable.');
    }
  }

  @Get()
  async listar(@Param('expedienteId') expedienteId: string, @CurrentUser() usuario: JwtPayloadUsuario) {
    await this.verificarAcceso(expedienteId, usuario);
    return this.seguimientoService.listarPorExpediente(expedienteId);
  }

  @Post()
  async crear(
    @Param('expedienteId') expedienteId: string,
    @Body() dto: CrearSeguimientoDto,
    @CurrentUser() usuario: JwtPayloadUsuario,
  ) {
    await this.verificarAcceso(expedienteId, usuario);
    return this.seguimientoService.crear(expedienteId, dto, usuario.sub);
  }
}
