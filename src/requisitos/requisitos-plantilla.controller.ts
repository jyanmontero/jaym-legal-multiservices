import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { RequisitosPlantillaService } from './requisitos-plantilla.service.js';
import { CreateRequisitoPlantillaDto, UpdateRequisitoPlantillaDto } from './dto/requisito.dto.js';
import { MateriaJuridica, RolUsuario } from '../common/enums/index.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';

@Controller('requisitos-plantilla')
export class RequisitosPlantillaController {
  constructor(private readonly plantillaService: RequisitosPlantillaService) {}

  @Get()
  listar(@Query('materia') materia?: MateriaJuridica) {
    return materia
      ? this.plantillaService.listarPorMateria(materia)
      : this.plantillaService.listarTodas();
  }

  // Solo roles de administración configuran el checklist base — un
  // asistente no debería poder redefinir qué se exige por materia.
  @Post()
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.SUPERADMINISTRADOR, RolUsuario.ABOGADO_ADMINISTRADOR)
  crear(@Body() dto: CreateRequisitoPlantillaDto) {
    return this.plantillaService.crear(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.SUPERADMINISTRADOR, RolUsuario.ABOGADO_ADMINISTRADOR)
  actualizar(@Param('id') id: string, @Body() dto: UpdateRequisitoPlantillaDto) {
    return this.plantillaService.actualizar(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.SUPERADMINISTRADOR, RolUsuario.ABOGADO_ADMINISTRADOR)
  desactivar(@Param('id') id: string) {
    return this.plantillaService.desactivar(id);
  }
}
