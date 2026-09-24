import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ColaboradoresPortalService } from './colaboradores-portal.service.js';
import { ColaboradorAuthGuard } from './colaborador-auth.guard.js';
import { CurrentColaborador } from './current-colaborador.decorator.js';

@Controller('colaboradores-portal')
@UseGuards(ColaboradorAuthGuard)
export class ColaboradoresPortalController {
  constructor(private readonly colaboradoresPortalService: ColaboradoresPortalService) {}

  @Get('expedientes')
  listarExpedientes(@CurrentColaborador('sub') colaboradorId: string) {
    return this.colaboradoresPortalService.listarExpedientes(colaboradorId);
  }

  @Get('expedientes/:id')
  obtenerExpediente(@Param('id') id: string, @CurrentColaborador('sub') colaboradorId: string) {
    return this.colaboradoresPortalService.obtenerExpediente(colaboradorId, id);
  }

  @Get('documentos')
  listarDocumentos(@Query('expedienteId') expedienteId: string, @CurrentColaborador('sub') colaboradorId: string) {
    return this.colaboradoresPortalService.listarDocumentos(colaboradorId, expedienteId);
  }

  @Get('documentos/:id/descargar')
  async descargarDocumento(@Param('id') id: string, @CurrentColaborador('sub') colaboradorId: string, @Res() res: Response) {
    const { documento, remoto } = await this.colaboradoresPortalService.descargarDocumento(colaboradorId, id);
    // Mismo criterio que PortalController/PlantillasController: el servidor
    // descarga el archivo de R2 y lo entrega directamente, para evitar el
    // bloqueo de CORS entre el frontend y Cloudflare.
    if (remoto) {
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(documento.nombreArchivo)}"`);
      if (remoto.contentType) res.setHeader('Content-Type', remoto.contentType);
      if (remoto.contentLength) res.setHeader('Content-Length', String(remoto.contentLength));
      remoto.body.pipe(res);
      return;
    }
    return res.status(404).json({ message: 'El archivo no está disponible en este momento.' });
  }

  @Get('tareas')
  listarTareas(@CurrentColaborador('sub') colaboradorId: string) {
    return this.colaboradoresPortalService.listarTareas(colaboradorId);
  }
}
