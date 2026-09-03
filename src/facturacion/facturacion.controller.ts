import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  NotFoundException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Response } from 'express';
import { FacturacionService } from './facturacion.service.js';
import { PdfService } from './pdf/pdf.service.js';
import { Cliente } from '../clientes/cliente.entity.js';
import { Expediente } from '../expedientes/expediente.entity.js';
import { CreateCotizacionDto, CambiarEstadoCotizacionDto } from './dto/cotizacion.dto.js';
import { CreateFacturaDto } from './dto/factura.dto.js';
import { CreatePagoDto } from './dto/pago.dto.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { EstadoCotizacion, EstadoFactura, ROLES_CON_ACCESO_FACTURACION } from '../common/enums/index.js';

@Controller('cotizaciones')
@UseGuards(RolesGuard)
@Roles(...ROLES_CON_ACCESO_FACTURACION)
export class CotizacionesController {
  constructor(
    private readonly facturacionService: FacturacionService,
    private readonly pdfService: PdfService,
    @InjectRepository(Cliente) private readonly clienteRepo: Repository<Cliente>,
    @InjectRepository(Expediente) private readonly expedienteRepo: Repository<Expediente>,
  ) {}

  @Get()
  listar(
    @Query('clienteId') clienteId?: string,
    @Query('expedienteId') expedienteId?: string,
    @Query('estado') estado?: EstadoCotizacion,
  ) {
    return this.facturacionService.listarCotizaciones({ clienteId, expedienteId, estado });
  }

  @Get(':id')
  obtener(@Param('id') id: string) {
    return this.facturacionService.obtenerCotizacion(id);
  }

  @Post()
  crear(@Body() dto: CreateCotizacionDto, @CurrentUser('sub') usuarioId: string) {
    return this.facturacionService.crearCotizacion(dto, usuarioId);
  }

  @Post(':id/estado')
  cambiarEstado(@Param('id') id: string, @Body() dto: CambiarEstadoCotizacionDto) {
    return this.facturacionService.cambiarEstadoCotizacion(id, dto.estado);
  }

  @Post(':id/convertir-a-factura')
  convertir(@Param('id') id: string, @CurrentUser('sub') usuarioId: string) {
    return this.facturacionService.convertirCotizacionAFactura(id, usuarioId);
  }

  // Elimina la cotizacion por completo -- pensada para corregir una que
  // quedó mal cargada, no como flujo normal de trabajo.
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  eliminar(@Param('id') id: string) {
    return this.facturacionService.eliminarCotizacion(id);
  }

  @Get(':id/pdf')
  async pdf(@Param('id') id: string, @Res() res: Response) {
    const cotizacion = await this.facturacionService.obtenerCotizacion(id);
    const cliente = await this.clienteRepo.findOne({ where: { id: cotizacion.clienteId } });
    if (!cliente) throw new NotFoundException('Cliente no encontrado');
    const expediente = cotizacion.expedienteId
      ? await this.expedienteRepo.findOne({ where: { id: cotizacion.expedienteId } })
      : null;
    const buffer = await this.pdfService.generarCotizacionPdf(cotizacion, cliente, expediente?.codigo);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${cotizacion.numero}.pdf"`);
    res.send(buffer);
  }
}

@Controller('facturas')
@UseGuards(RolesGuard)
@Roles(...ROLES_CON_ACCESO_FACTURACION)
export class FacturasController {
  constructor(
    private readonly facturacionService: FacturacionService,
    private readonly pdfService: PdfService,
    @InjectRepository(Cliente) private readonly clienteRepo: Repository<Cliente>,
    @InjectRepository(Expediente) private readonly expedienteRepo: Repository<Expediente>,
  ) {}

  @Get()
  listar(
    @Query('clienteId') clienteId?: string,
    @Query('expedienteId') expedienteId?: string,
    @Query('estado') estado?: EstadoFactura,
  ) {
    return this.facturacionService.listarFacturas({ clienteId, expedienteId, estado });
  }

  @Get(':id')
  obtener(@Param('id') id: string) {
    return this.facturacionService.obtenerFactura(id);
  }

  @Post()
  crear(@Body() dto: CreateFacturaDto, @CurrentUser('sub') usuarioId: string) {
    return this.facturacionService.crearFactura(dto, usuarioId);
  }

  @Post(':id/anular')
  anular(@Param('id') id: string) {
    return this.facturacionService.anularFactura(id);
  }

  // Elimina la factura por completo -- pensada para corregir una que quedó
  // mal cargada (duplicada, creada por error). Para anular una factura
  // válida ya emitida, usa /facturas/:id/anular en vez de esto.
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  eliminar(@Param('id') id: string) {
    return this.facturacionService.eliminarFactura(id);
  }

  @Get(':id/pagos')
  listarPagos(@Param('id') id: string) {
    return this.facturacionService.listarPagos(id);
  }

  @Delete(':id/pagos/:pagoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  eliminarPago(@Param('id') id: string, @Param('pagoId') pagoId: string) {
    return this.facturacionService.eliminarPago(id, pagoId);
  }

  @Post(':id/pagos')
  registrarPago(
    @Param('id') id: string,
    @Body() dto: CreatePagoDto,
    @CurrentUser('sub') usuarioId: string,
  ) {
    return this.facturacionService.registrarPago(id, dto, usuarioId);
  }

  @Get(':id/pdf')
  async pdf(@Param('id') id: string, @Res() res: Response) {
    const factura = await this.facturacionService.obtenerFactura(id);
    const cliente = await this.clienteRepo.findOne({ where: { id: factura.clienteId } });
    if (!cliente) throw new NotFoundException('Cliente no encontrado');
    const expediente = factura.expedienteId
      ? await this.expedienteRepo.findOne({ where: { id: factura.expedienteId } })
      : null;
    const buffer = await this.pdfService.generarFacturaPdf(factura, cliente, expediente?.codigo);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${factura.numero}.pdf"`);
    res.send(buffer);
  }
}

@Controller('facturacion')
@UseGuards(RolesGuard)
@Roles(...ROLES_CON_ACCESO_FACTURACION)
export class FacturacionController {
  constructor(private readonly facturacionService: FacturacionService) {}

  @Get('estado-cuenta/:clienteId')
  estadoDeCuenta(@Param('clienteId') clienteId: string) {
    return this.facturacionService.estadoDeCuenta(clienteId);
  }

  @Get('dashboard')
  dashboard() {
    return this.facturacionService.dashboardFinanciero();
  }
}
