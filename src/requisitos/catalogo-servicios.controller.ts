import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsArray, IsOptional, IsString } from 'class-validator';
import { CatalogoServiciosService } from './catalogo-servicios.service.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RolUsuario } from '../common/enums/index.js';

class AprobarDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  codigos?: string[];
}

@Controller('catalogo-servicios')
export class CatalogoServiciosController {
  constructor(private readonly catalogo: CatalogoServiciosService) {}

  /** Área → Servicios (con sus preguntas de perfil) para crear un expediente. */
  @Get()
  arbol() {
    return this.catalogo.listarArbol();
  }

  @Post('cargar')
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.SUPERADMINISTRADOR, RolUsuario.ABOGADO_ADMINISTRADOR)
  cargar() {
    return this.catalogo.cargar();
  }

  @Get('pendientes-de-validar')
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.SUPERADMINISTRADOR, RolUsuario.ABOGADO_ADMINISTRADOR)
  pendientes() {
    return this.catalogo.pendientesDeValidar();
  }

  @Post('aprobar')
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.SUPERADMINISTRADOR, RolUsuario.ABOGADO_ADMINISTRADOR)
  aprobar(@Body() dto: AprobarDto, @CurrentUser('sub') usuarioId: string) {
    return this.catalogo.aprobar(dto.codigos, usuarioId);
  }

  /** Dry-run: propone servicio para expedientes existentes sin modificar nada. */
  @Get('propuesta-expedientes-existentes')
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.SUPERADMINISTRADOR, RolUsuario.ABOGADO_ADMINISTRADOR)
  propuesta() {
    return this.catalogo.propuestaParaExistentes();
  }
}
