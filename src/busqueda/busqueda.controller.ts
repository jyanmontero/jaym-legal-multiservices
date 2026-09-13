import { Controller, Get, Query } from '@nestjs/common';
import { BusquedaService } from './busqueda.service.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtPayloadUsuario } from '../auth/decorators/current-user.decorator.js';
import { RolUsuario } from '../common/enums/index.js';

@Controller('busqueda')
export class BusquedaController {
  constructor(private readonly busquedaService: BusquedaService) {}

  @Get()
  buscar(@Query('q') q: string = '', @CurrentUser() usuario: JwtPayloadUsuario) {
    return this.busquedaService.buscar(q, { id: usuario.sub, rol: usuario.rol as RolUsuario });
  }
}
