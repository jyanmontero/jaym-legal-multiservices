import { Controller, Get, Post, Patch, Body, Param, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { PlantillasService } from './plantillas.service.js';
import { DocumentosService } from '../documentos/documentos.service.js';
import { CrearSolicitudDocumentoDto } from './dto/crear-solicitud.dto.js';
import { CompletarSolicitudDto } from './dto/completar-solicitud.dto.js';
import { RevisarSolicitudDocumentoDto } from './dto/revisar-solicitud.dto.js';
import { IniciarSolicitudPublicaDto } from './dto/iniciar-solicitud-publica.dto.js';
import { ConfirmarPagoDto } from './dto/confirmar-pago.dto.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { ROLES_CON_ACCESO_PLANTILLAS, ROLES_QUE_APRUEBAN_PLANTILLAS } from '../common/enums/index.js';

// Catálogo de plantillas disponibles -- para que el personal interno elija
// cuál usar al crear una solicitud.
@Controller('plantillas')
@UseGuards(RolesGuard)
@Roles(...ROLES_CON_ACCESO_PLANTILLAS)
export class PlantillasCatalogoController {
  constructor(private readonly plantillasService: PlantillasService) {}

  @Get()
  listar() {
    return this.plantillasService.listarCatalogo();
  }
}

// Endpoints públicos (sin JWT) -- son los que abre el cliente final desde
// el enlace que le envía el despacho. Se registran en un controller propio
// para que @Public() nunca quede aplicado por accidente a una ruta interna.
@Controller('solicitudes-documento')
export class SolicitudesDocumentoPublicoController {
  constructor(private readonly plantillasService: PlantillasService) {}

  // IMPORTANTE: estas dos rutas literales ('catalogo', 'iniciar') deben ir
  // declaradas ANTES que 'publico/:token' en este mismo controller -- Nest
  // registra las rutas de un controller en orden de declaración, y si
  // 'publico/:token' fuera primero, capturaría también '/publico/catalogo'
  // y '/publico/iniciar' como si 'catalogo'/'iniciar' fueran el token.

  // Catálogo público -- para que la web/landing muestre las plantillas
  // disponibles con su precio, sin necesidad de sesión.
  @Public()
  @Get('publico/catalogo')
  catalogoPublico() {
    return this.plantillasService.listarCatalogo();
  }

  // Autoservicio: cualquiera elige una plantilla y arranca su propia
  // solicitud, sin que el despacho la cree primero.
  @Public()
  @Post('publico/iniciar')
  iniciarPublico(@Body() dto: IniciarSolicitudPublicaDto) {
    return this.plantillasService.iniciarPublico(dto);
  }

  @Public()
  @Get('publico/:token')
  obtenerPublico(@Param('token') token: string) {
    return this.plantillasService.obtenerPorToken(token);
  }

  @Public()
  @Post('publico/:token')
  completarPublico(@Param('token') token: string, @Body() dto: CompletarSolicitudDto) {
    return this.plantillasService.completarPorToken(token, dto);
  }
}

// Gestión interna de solicitudes de documento.
@Controller('solicitudes-documento')
@UseGuards(RolesGuard)
@Roles(...ROLES_CON_ACCESO_PLANTILLAS)
export class SolicitudesDocumentoController {
  constructor(
    private readonly plantillasService: PlantillasService,
    private readonly documentosService: DocumentosService,
  ) {}

  @Post()
  crear(@Body() dto: CrearSolicitudDocumentoDto, @CurrentUser('sub') usuarioId: string) {
    return this.plantillasService.crear(dto, usuarioId);
  }

  @Get()
  listar(
    @Query('estado') estado?: string,
    @Query('expedienteId') expedienteId?: string,
    @Query('clienteId') clienteId?: string,
  ) {
    return this.plantillasService.listar({ estado, expedienteId, clienteId });
  }

  @Get(':id')
  obtener(@Param('id') id: string) {
    return this.plantillasService.obtenerConPlantilla(id);
  }

  // Aprobar o pedir correcciones -- restringido a un grupo más pequeño de
  // roles que el resto del módulo (ver ROLES_QUE_APRUEBAN_PLANTILLAS).
  // Marcar que el pago de esta solicitud ya fue recibido (transferencia
  // verificada manualmente, efectivo en oficina, etc.) -- abierto al mismo
  // grupo de roles que gestiona las solicitudes, no solo a quien aprueba.
  @Patch(':id/confirmar-pago')
  confirmarPago(
    @Param('id') id: string,
    @Body() dto: ConfirmarPagoDto,
    @CurrentUser('sub') usuarioId: string,
  ) {
    return this.plantillasService.confirmarPago(id, dto, usuarioId);
  }

  @Patch(':id/revisar')
  @UseGuards(RolesGuard)
  @Roles(...ROLES_QUE_APRUEBAN_PLANTILLAS)
  revisar(
    @Param('id') id: string,
    @Body() dto: RevisarSolicitudDocumentoDto,
    @CurrentUser('sub') usuarioId: string,
  ) {
    return this.plantillasService.revisar(id, dto, usuarioId);
  }

  @Get(':id/pdf')
  async descargarPdf(@Param('id') id: string, @Res() res: Response) {
    const { solicitud } = await this.plantillasService.obtenerConPlantilla(id);
    if (!solicitud.documentoGeneradoId) {
      res.status(404).json({ message: 'Este documento aún no ha sido aprobado.' });
      return;
    }
    const documento = await this.documentosService.obtenerPorId(solicitud.documentoGeneradoId);
    const ruta = await this.documentosService.rutaFisica(documento);
    res.download(ruta, documento.nombreArchivo);
  }
}
