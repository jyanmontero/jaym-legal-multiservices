import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { ComprasService } from './compras.service.js';
import { ReporteImpuestosService } from './reporte-impuestos.service.js';
import { AnularCompraDto, CreateCompraDto } from './dto/compra.dto.js';
import { AlmacenamientoService } from '../documentos/almacenamiento.service.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { PermisosGuard } from '../auth/guards/permisos.guard.js';
import { Permisos } from '../auth/decorators/permisos.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { ROLES_CON_ACCESO_FACTURACION, Permiso } from '../common/enums/index.js';

const TIPOS_PERMITIDOS = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

const opcionesArchivo = {
  storage: memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (error: Error | null, accept: boolean) => void) => {
    if (!TIPOS_PERMITIDOS.has(file.mimetype)) {
      cb(new BadRequestException('Formato no permitido. Sube una foto (JPG, PNG o WebP) o un PDF.'), false);
      return;
    }
    cb(null, true);
  },
};

function aEntero(valor: string | undefined, nombre: string, min: number, max: number): number {
  const n = Number(valor);
  if (!Number.isInteger(n) || n < min || n > max) throw new BadRequestException(`${nombre} no es válido.`);
  return n;
}

function periodo(anio?: string, mes?: string): { anio: number; mes: number } {
  const hoy = new Date();
  return {
    anio: anio ? aEntero(anio, 'El año', 2020, 2100) : hoy.getFullYear(),
    mes: mes ? aEntero(mes, 'El mes', 1, 12) : hoy.getMonth() + 1,
  };
}

/** Facturas de gasto (compras) con valor fiscal -- 606 e ITBIS adelantable. */
@Controller('compras')
@UseGuards(RolesGuard, PermisosGuard)
@Roles(...ROLES_CON_ACCESO_FACTURACION)
export class ComprasController {
  constructor(
    private readonly compras: ComprasService,
    private readonly almacenamiento: AlmacenamientoService,
  ) {}

  // Cada lectura es una llamada real a la API de Anthropic: límite propio.
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('leer')
  @Permisos(Permiso.FACTURAR)
  @UseInterceptors(FileInterceptor('archivo', opcionesArchivo))
  leer(@UploadedFile() archivo: Express.Multer.File | undefined) {
    if (!archivo) throw new BadRequestException('Adjunta la foto o el PDF de la factura.');
    return this.compras.leerArchivo(archivo);
  }

  @Post()
  @Permisos(Permiso.FACTURAR)
  @UseInterceptors(FileInterceptor('archivo', opcionesArchivo))
  crear(
    @Body() dto: CreateCompraDto,
    @UploadedFile() archivo: Express.Multer.File | undefined,
    @CurrentUser('sub') usuarioId: string,
  ) {
    return this.compras.crear(dto, archivo, usuarioId);
  }

  @Get()
  listar(
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('incluirAnuladas') incluirAnuladas?: string,
  ) {
    return this.compras.listar({ desde, hasta, incluirAnuladas: incluirAnuladas === 'true' });
  }

  @Get(':id')
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.compras.obtener(id);
  }

  @Get(':id/historial')
  historial(@Param('id', ParseUUIDPipe) id: string) {
    return this.compras.historial(id);
  }

  @Get(':id/archivo')
  async archivo(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const compra = await this.compras.obtener(id);
    if (!compra.archivoClave) throw new BadRequestException('Esta factura de gasto no tiene archivo adjunto.');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    const remoto = await this.almacenamiento.streamDescarga(compra.archivoClave);
    if (remoto) {
      res.setHeader('Content-Type', compra.archivoMime ?? remoto.contentType ?? 'application/octet-stream');
      if (remoto.contentLength) res.setHeader('Content-Length', String(remoto.contentLength));
      remoto.body.pipe(res);
      return;
    }
    res.setHeader('Content-Type', compra.archivoMime ?? 'application/octet-stream');
    return res.sendFile(this.almacenamiento.rutaLocal(compra.archivoClave), { root: '/' });
  }

  @Post(':id/anular')
  @Permisos(Permiso.FACTURAR)
  anular(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AnularCompraDto, @CurrentUser('sub') usuarioId: string) {
    return this.compras.anular(id, dto.motivo, usuarioId);
  }
}

/** Reporte mensual de impuestos: resumen de ITBIS, Excel de apoyo y archivos 606/607. */
@Controller('impuestos')
@UseGuards(RolesGuard, PermisosGuard)
@Roles(...ROLES_CON_ACCESO_FACTURACION)
export class ImpuestosController {
  constructor(private readonly reporte: ReporteImpuestosService) {}

  @Get('resumen')
  resumen(@Query('anio') anio?: string, @Query('mes') mes?: string) {
    const p = periodo(anio, mes);
    return this.reporte.resumen(p.anio, p.mes);
  }

  @Get('excel')
  @Permisos(Permiso.DESCARGAR)
  async excel(@Query('anio') anio: string | undefined, @Query('mes') mes: string | undefined, @Res() res: Response) {
    const p = periodo(anio, mes);
    const { nombre, buffer } = await this.reporte.excel(p.anio, p.mes);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(buffer);
  }

  @Get('606')
  @Permisos(Permiso.DESCARGAR)
  async txt606(@Query('anio') anio: string | undefined, @Query('mes') mes: string | undefined, @Res() res: Response) {
    const p = periodo(anio, mes);
    const { nombre, contenido } = await this.reporte.txt606(p.anio, p.mes);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(contenido);
  }

  @Get('607')
  @Permisos(Permiso.DESCARGAR)
  async txt607(@Query('anio') anio: string | undefined, @Query('mes') mes: string | undefined, @Res() res: Response) {
    const p = periodo(anio, mes);
    const { nombre, contenido } = await this.reporte.txt607(p.anio, p.mes);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(contenido);
  }
}
