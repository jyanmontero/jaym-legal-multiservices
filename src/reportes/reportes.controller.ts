import { Controller, Get, Query, Param, Res, UseGuards, BadRequestException } from '@nestjs/common';
import type { Response } from 'express';
import { ReportesService } from './reportes.service.js';
import { generarExcelReporte, generarPdfReporte, type DatosReporte } from './reportes-exportar.util.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolUsuario } from '../common/enums/index.js';

const ROLES_REPORTES = [RolUsuario.SUPERADMINISTRADOR, RolUsuario.ABOGADO_ADMINISTRADOR];
const ROLES_REPORTES_FINANCIEROS = [...ROLES_REPORTES, RolUsuario.FACTURACION_CONTABILIDAD];

function slug(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

@Controller('reportes')
@UseGuards(RolesGuard)
@Roles(...ROLES_REPORTES)
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  @Get()
  catalogo() {
    return this.reportesService.catalogo();
  }

  private async responder(res: Response, datos: DatosReporte, formato?: string) {
    const nombreArchivo = `${slug(datos.titulo)}-${new Date().toISOString().slice(0, 10)}`;
    if (formato === 'pdf') {
      const buffer = await generarPdfReporte(datos);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${nombreArchivo}.pdf"`,
      });
      res.send(buffer);
      return;
    }
    if (formato && formato !== 'excel') {
      throw new BadRequestException('El parámetro formato debe ser "excel" o "pdf"');
    }
    const buffer = await generarExcelReporte(datos);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nombreArchivo}.xlsx"`,
    });
    res.send(buffer);
  }

  @Get('expedientes-activos')
  async expedientesActivos(@Query('formato') formato: string, @Res() res: Response) {
    await this.responder(res, await this.reportesService.expedientesActivos(), formato);
  }

  @Get('expedientes-por-estado')
  async expedientesPorEstado(@Query('formato') formato: string, @Res() res: Response) {
    await this.responder(res, await this.reportesService.expedientesPorEstado(), formato);
  }

  @Get('expedientes-por-institucion')
  async expedientesPorInstitucion(@Query('formato') formato: string, @Res() res: Response) {
    await this.responder(res, await this.reportesService.expedientesPorInstitucion(), formato);
  }

  @Get('expedientes-incompletos')
  async expedientesIncompletos(@Query('formato') formato: string, @Res() res: Response) {
    await this.responder(res, await this.reportesService.expedientesIncompletos(), formato);
  }

  @Get('expedientes-sin-seguimiento')
  async expedientesSinSeguimiento(@Query('formato') formato: string, @Res() res: Response) {
    await this.responder(res, await this.reportesService.expedientesSinSeguimiento(), formato);
  }

  @Get('audiencias-vencimientos')
  async audienciasYVencimientos(
    @Query('formato') formato: string,
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
    @Res() res: Response,
  ) {
    await this.responder(res, await this.reportesService.audienciasYVencimientos(desde, hasta), formato);
  }

  @Get('productividad-abogados')
  async productividadPorAbogado(@Query('formato') formato: string, @Res() res: Response) {
    await this.responder(res, await this.reportesService.productividadPorAbogado(), formato);
  }

  @Get('historial-individual/:expedienteId')
  async historialIndividual(
    @Param('expedienteId') expedienteId: string,
    @Query('formato') formato: string,
    @Res() res: Response,
  ) {
    await this.responder(res, await this.reportesService.historialIndividual(expedienteId), formato);
  }

  @Get('facturacion')
  @Roles(...ROLES_REPORTES_FINANCIEROS)
  async facturacion(
    @Query('formato') formato: string,
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
    @Res() res: Response,
  ) {
    await this.responder(res, await this.reportesService.facturacion(desde, hasta), formato);
  }

  @Get('pagos')
  @Roles(...ROLES_REPORTES_FINANCIEROS)
  async pagos(
    @Query('formato') formato: string,
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
    @Res() res: Response,
  ) {
    await this.responder(res, await this.reportesService.pagos(desde, hasta), formato);
  }

  @Get('cuentas-por-cobrar')
  @Roles(...ROLES_REPORTES_FINANCIEROS)
  async cuentasPorCobrar(@Query('formato') formato: string, @Res() res: Response) {
    await this.responder(res, await this.reportesService.cuentasPorCobrar(), formato);
  }

  @Get('gastos-por-expediente')
  @Roles(...ROLES_REPORTES_FINANCIEROS)
  async gastosPorExpediente(
    @Query('formato') formato: string,
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
    @Res() res: Response,
  ) {
    await this.responder(res, await this.reportesService.gastosPorExpediente(desde, hasta), formato);
  }

  @Get('rentabilidad-por-servicio')
  @Roles(...ROLES_REPORTES_FINANCIEROS)
  async rentabilidadPorServicio(
    @Query('formato') formato: string,
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
    @Res() res: Response,
  ) {
    await this.responder(res, await this.reportesService.rentabilidadPorServicio(desde, hasta), formato);
  }

  @Get('historial-modificaciones')
  async historialModificaciones(
    @Query('formato') formato: string,
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
    @Res() res: Response,
  ) {
    await this.responder(res, await this.reportesService.historialModificaciones(desde, hasta), formato);
  }

  @Get('actividad-usuarios')
  async actividadUsuarios(@Query('formato') formato: string, @Res() res: Response) {
    await this.responder(res, await this.reportesService.actividadUsuarios(), formato);
  }
}
