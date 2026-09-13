import { Controller, Post, Param, UseGuards, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HubSpotService } from './hubspot.service.js';
import { Cliente } from '../../clientes/cliente.entity.js';
import { Expediente } from '../../expedientes/expediente.entity.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { RolUsuario } from '../../common/enums/index.js';

@Controller('integraciones/hubspot')
@UseGuards(RolesGuard)
@Roles(RolUsuario.SUPERADMINISTRADOR, RolUsuario.ABOGADO_ADMINISTRADOR)
export class HubSpotController {
  constructor(
    private readonly hubspotService: HubSpotService,
    @InjectRepository(Cliente) private readonly clienteRepo: Repository<Cliente>,
    @InjectRepository(Expediente) private readonly expedienteRepo: Repository<Expediente>,
  ) {}

  /**
   * Un solo uso: crea en HubSpot las Custom Properties que este servicio
   * necesita (cedula_rnc, códigos internos, materia, balance). Seguro de
   * ejecutar varias veces. Solo Superadministrador — toca configuración
   * del portal de HubSpot completo, no solo un registro.
   */
  @Post('configurar')
  @Roles(RolUsuario.SUPERADMINISTRADOR)
  configurar() {
    return this.hubspotService.asegurarPropiedades();
  }

  @Post('clientes/:id/sincronizar')
  async sincronizarCliente(@Param('id') id: string) {
    const cliente = await this.clienteRepo.findOne({ where: { id } });
    if (!cliente) throw new NotFoundException('Cliente no encontrado');
    const hubspotId = await this.hubspotService.sincronizarContacto(cliente);
    return { sincronizado: true, hubspotContactId: hubspotId };
  }

  @Post('expedientes/:id/sincronizar')
  async sincronizarExpediente(@Param('id') id: string) {
    const expediente = await this.expedienteRepo.findOne({ where: { id } });
    if (!expediente) throw new NotFoundException('Expediente no encontrado');
    const cliente = await this.clienteRepo.findOne({ where: { id: expediente.clienteId } });
    if (!cliente) throw new NotFoundException('Cliente del expediente no encontrado');
    const hubspotId = await this.hubspotService.sincronizarExpediente(expediente, cliente);
    return { sincronizado: true, hubspotDealId: hubspotId };
  }
}
