import { BadRequestException, Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CobrosService } from './cobros.service.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { ROLES_CON_ACCESO_FACTURACION } from '../common/enums/index.js';
import {
  EnviarCobroCorreoDto,
  HistorialCobrosQueryDto,
  RegistrarWhatsappDto,
  TIPOS_COBRO,
  type TipoCobro,
} from './dto/cobros.dto.js';

@Controller('cobros')
@UseGuards(RolesGuard)
@Roles(...ROLES_CON_ACCESO_FACTURACION)
export class CobrosController {
  constructor(private readonly cobros: CobrosService) {}

  /** Borrador editable (correo + WhatsApp) de una cotización, factura o recordatorio. No envía nada. */
  @Get('borrador')
  borrador(@Query('tipo') tipo: string, @Query('id') id: string) {
    if (!TIPOS_COBRO.includes(tipo as TipoCobro) || !id) {
      throw new BadRequestException('Indica el tipo (cotizacion, factura o recordatorio) y el id.');
    }
    return this.cobros.borrador(tipo as TipoCobro, id);
  }

  @Post('enviar-correo')
  enviarCorreo(@Body() dto: EnviarCobroCorreoDto, @CurrentUser('sub') usuarioId: string) {
    return this.cobros.enviarCorreo(dto, usuarioId);
  }

  @Post('registrar-whatsapp')
  registrarWhatsapp(@Body() dto: RegistrarWhatsappDto, @CurrentUser('sub') usuarioId: string) {
    return this.cobros.registrarWhatsapp(dto, usuarioId);
  }

  @Get('historial')
  historial(@Query() q: HistorialCobrosQueryDto) {
    return this.cobros.historial(q);
  }
}
