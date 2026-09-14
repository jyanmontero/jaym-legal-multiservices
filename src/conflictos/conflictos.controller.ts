import { Controller, Get, Query } from '@nestjs/common';
import { ConflictosService } from './conflictos.service.js';

@Controller('conflictos')
export class ConflictosController {
  constructor(private readonly conflictosService: ConflictosService) {}

  // Sin @Roles adicional a propósito -- igual que /clientes, cualquier
  // usuario autenticado (JwtAuthGuard global) puede consultar esto: es una
  // verificación preventiva, no expone nada que ese usuario no pudiera ver
  // ya buscando manualmente en Clientes o Expedientes.
  @Get('verificar')
  verificar(
    @Query('nombre') nombre?: string,
    @Query('excluirClienteId') excluirClienteId?: string,
    @Query('excluirExpedienteId') excluirExpedienteId?: string,
  ) {
    return this.conflictosService.verificarPorNombre(nombre, {
      excluirClienteId,
      excluirExpedienteId,
    });
  }
}
