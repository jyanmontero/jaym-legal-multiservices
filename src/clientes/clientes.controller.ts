import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Patch,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ClientesService } from './clientes.service.js';
import { CreateClienteDto, UpdateClienteDto } from './dto/create-cliente.dto.js';
import { TipoCliente } from '../common/enums/index.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';

@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Get()
  buscar(@Query('q') q?: string, @Query('tipo') tipo?: TipoCliente) {
    return this.clientesService.buscar(q, tipo);
  }

  @Get(':id')
  obtener(@Param('id') id: string) {
    return this.clientesService.obtenerPorId(id);
  }

  /**
   * Crea un cliente. Si se detectan posibles duplicados, la respuesta trae
   * `duplicados` en vez de `cliente`, con código 200 (no es un error, es una
   * advertencia para que el usuario decida). Para forzar la creación pese a
   * la coincidencia, se reenvía la misma solicitud con ?forzar=true.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  crear(
    @Body() dto: CreateClienteDto,
    @Query('forzar') forzar: string | undefined,
    @CurrentUser('sub') usuarioId: string,
  ) {
    return this.clientesService.crear(dto, {
      forzarPeseADuplicado: forzar === 'true',
      usuarioId,
    });
  }

  @Patch(':id')
  actualizar(@Param('id') id: string, @Body() dto: UpdateClienteDto) {
    return this.clientesService.actualizar(id, dto);
  }
}
