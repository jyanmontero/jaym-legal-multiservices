import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipeBuilder,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { PortalDatosService } from './portal-datos.service.js';
import { PortalAuthGuard } from './portal-auth.guard.js';
import { CurrentPortalUsuario } from './current-portal-usuario.decorator.js';
import { CrearMensajeDto } from './dto/mensaje.dto.js';
import { opcionesMulter } from '../documentos/documentos.controller.js';
import { CategoriaDocumento } from '../common/enums/index.js';

@Controller('portal')
@UseGuards(PortalAuthGuard)
export class PortalController {
  constructor(private readonly portalDatosService: PortalDatosService) {}

  @Get('expedientes')
  listarExpedientes(@CurrentPortalUsuario('clienteId') clienteId: string) {
    return this.portalDatosService.listarExpedientes(clienteId);
  }

  @Get('expedientes/:id')
  obtenerExpediente(@Param('id') id: string, @CurrentPortalUsuario('clienteId') clienteId: string) {
    return this.portalDatosService.obtenerExpediente(clienteId, id);
  }

  @Get('documentos')
  listarDocumentos(@Query('expedienteId') expedienteId: string, @CurrentPortalUsuario('clienteId') clienteId: string) {
    return this.portalDatosService.listarDocumentos(clienteId, expedienteId);
  }

  @Post('documentos')
  @UseInterceptors(FileInterceptor('archivo', opcionesMulter))
  subirDocumento(
    @Body('expedienteId') expedienteId: string,
    @Body('categoria') categoria: CategoriaDocumento,
    @Body('descripcion') descripcion: string,
    @UploadedFile(new ParseFilePipeBuilder().build({ fileIsRequired: true, errorHttpStatusCode: HttpStatus.BAD_REQUEST }))
    archivo: Express.Multer.File,
    @CurrentPortalUsuario('clienteId') clienteId: string,
    @CurrentPortalUsuario('sub') portalUsuarioId: string,
  ) {
    return this.portalDatosService.subirDocumento(clienteId, portalUsuarioId, archivo, { expedienteId, categoria, descripcion });
  }

  @Get('documentos/:id/descargar')
  async descargarDocumento(@Param('id') id: string, @CurrentPortalUsuario('clienteId') clienteId: string, @Res() res: Response) {
    const { documento, remoto } = await this.portalDatosService.descargarDocumento(clienteId, id);
    // El servidor descarga el archivo de R2 y lo entrega directamente (en
    // vez de redirigir el navegador del cliente hacia una URL firmada de
    // R2), para evitar el bloqueo de CORS entre el portal y Cloudflare.
    if (remoto) {
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(documento.nombreArchivo)}"`,
      );
      if (remoto.contentType) res.setHeader('Content-Type', remoto.contentType);
      if (remoto.contentLength) res.setHeader('Content-Length', String(remoto.contentLength));
      remoto.body.pipe(res);
      return;
    }
    return res.status(404).json({ message: 'El archivo no está disponible en este momento.' });
  }

  @Get('facturas')
  estadoDeCuenta(@CurrentPortalUsuario('clienteId') clienteId: string) {
    return this.portalDatosService.estadoDeCuenta(clienteId);
  }

  @Get('facturas/:id/pdf')
  async descargarFactura(@Param('id') id: string, @CurrentPortalUsuario('clienteId') clienteId: string, @Res() res: Response) {
    const { buffer, numero } = await this.portalDatosService.descargarFacturaPdf(clienteId, id);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${numero}.pdf"` });
    res.send(buffer);
  }

  @Get('agenda')
  listarAgenda(@CurrentPortalUsuario('clienteId') clienteId: string) {
    return this.portalDatosService.listarAgenda(clienteId);
  }

  @Post('agenda/:id/confirmar')
  confirmarCita(@Param('id') id: string, @CurrentPortalUsuario('clienteId') clienteId: string) {
    return this.portalDatosService.confirmarCita(clienteId, id);
  }

  @Get('mensajes')
  listarMensajes(@Query('expedienteId') expedienteId: string, @CurrentPortalUsuario('clienteId') clienteId: string) {
    return this.portalDatosService.listarMensajes(clienteId, expedienteId);
  }

  @Post('mensajes')
  enviarMensaje(@Body() dto: CrearMensajeDto, @CurrentPortalUsuario('clienteId') clienteId: string, @CurrentPortalUsuario('sub') portalUsuarioId: string) {
    return this.portalDatosService.enviarMensaje(clienteId, portalUsuarioId, dto.expedienteId, dto.contenido);
  }
}
