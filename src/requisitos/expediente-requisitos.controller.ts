import { Controller, ForbiddenException, Get, NotFoundException, Post, Patch, Body, Param } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExpedienteRequisitosService } from './expediente-requisitos.service.js';
import { CrearRequisitoManualDto, ActualizarRequisitoDto } from './dto/requisito.dto.js';
import { Expediente } from '../expedientes/expediente.entity.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtPayloadUsuario } from '../auth/decorators/current-user.decorator.js';
import { RolUsuario, ROLES_CON_VISIBILIDAD_TOTAL_EXPEDIENTES } from '../common/enums/index.js';

@Controller('expedientes/:expedienteId/requisitos')
export class ExpedienteRequisitosController {
  constructor(
    private readonly requisitosService: ExpedienteRequisitosService,
    // Inyectado directamente (en vez de importar ExpedientesModule) para
    // evitar una dependencia circular -- ver comentario en RequisitosModule.
    // Duplica la regla de ExpedientesService.verificarVisibilidad(): sin
    // visibilidad total, solo el abogado responsable (o nadie, si el
    // expediente no tiene responsable) puede ver o modificar su checklist
    // de requisitos -- antes, cualquier usuario autenticado podía leer Y
    // escribir el checklist de cualquier expediente conociendo su id.
    @InjectRepository(Expediente) private readonly expedienteRepo: Repository<Expediente>,
  ) {}

  private async verificarVisibilidadExpediente(
    expedienteId: string,
    usuario: JwtPayloadUsuario,
  ): Promise<void> {
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
    await this.verificarVisibilidadExpediente(expedienteId, usuario);
    return this.requisitosService.listarPorExpediente(expedienteId);
  }

  @Get('progreso')
  async progreso(@Param('expedienteId') expedienteId: string, @CurrentUser() usuario: JwtPayloadUsuario) {
    await this.verificarVisibilidadExpediente(expedienteId, usuario);
    return this.requisitosService.calcularProgreso(expedienteId);
  }

  @Post()
  async agregarManual(
    @Param('expedienteId') expedienteId: string,
    @Body() dto: CrearRequisitoManualDto,
    @CurrentUser() usuario: JwtPayloadUsuario,
  ) {
    await this.verificarVisibilidadExpediente(expedienteId, usuario);
    return this.requisitosService.agregarManual(expedienteId, dto);
  }

  @Patch(':id')
  async actualizar(
    @Param('expedienteId') expedienteId: string,
    @Param('id') id: string,
    @Body() dto: ActualizarRequisitoDto,
    @CurrentUser() usuario: JwtPayloadUsuario,
  ) {
    // El expedienteId viene del path del controlador (esta ruta anidada
    // resuelve a expedientes/:expedienteId/requisitos/:id). Igualmente se
    // confirma que el requisito pertenezca a ese expediente antes de
    // aplicar la regla, para que no baste con adivinar cualquier
    // expedienteId visible y colar el id de un requisito ajeno.
    const requisito = await this.requisitosService.obtenerPorId(id);
    if (requisito.expedienteId !== expedienteId) {
      throw new NotFoundException('Requisito no encontrado en este expediente');
    }
    await this.verificarVisibilidadExpediente(expedienteId, usuario);
    return this.requisitosService.actualizar(id, dto);
  }
}
