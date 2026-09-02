import { Controller, Get, Post, Patch, Body, Param } from '@nestjs/common';
import { ExpedienteRequisitosService } from './expediente-requisitos.service.js';
import { CrearRequisitoManualDto, ActualizarRequisitoDto } from './dto/requisito.dto.js';

@Controller('expedientes/:expedienteId/requisitos')
export class ExpedienteRequisitosController {
  constructor(private readonly requisitosService: ExpedienteRequisitosService) {}

  @Get()
  listar(@Param('expedienteId') expedienteId: string) {
    return this.requisitosService.listarPorExpediente(expedienteId);
  }

  @Get('progreso')
  progreso(@Param('expedienteId') expedienteId: string) {
    return this.requisitosService.calcularProgreso(expedienteId);
  }

  @Post()
  agregarManual(
    @Param('expedienteId') expedienteId: string,
    @Body() dto: CrearRequisitoManualDto,
  ) {
    return this.requisitosService.agregarManual(expedienteId, dto);
  }

  @Patch(':id')
  actualizar(@Param('id') id: string, @Body() dto: ActualizarRequisitoDto) {
    return this.requisitosService.actualizar(id, dto);
  }
}
