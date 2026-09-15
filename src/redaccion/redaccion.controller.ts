import { BadRequestException, Body, Controller, Post, Res, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { RedaccionService, type TipoDocumentoRedaccion } from './redaccion.service.js';
import { RedaccionDocxService } from './redaccion-docx.service.js';
import { ExportarDocxDto } from './dto/exportar-docx.dto.js';

const TAMANO_MAXIMO_REFERENCIA_BYTES = 30 * 1024 * 1024; // 30 MB por archivo (por debajo del límite de Claude para PDFs, ~32 MB)
const EXTENSIONES_PERMITIDAS = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.heic', '.tif', '.tiff']);
const TIPOS_MIME_PERMITIDOS = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/tiff',
  'application/octet-stream',
]);

const opcionesMulterReferencias = {
  storage: memoryStorage(),
  limits: { fileSize: TAMANO_MAXIMO_REFERENCIA_BYTES },
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
    const extension = extname(file.originalname).toLowerCase();
    if (!EXTENSIONES_PERMITIDAS.has(extension) || !TIPOS_MIME_PERMITIDOS.has(file.mimetype)) {
      cb(new BadRequestException('Formato no permitido. Adjunta fotos/escaneos (JPG, PNG, HEIC) o PDFs.'), false);
      return;
    }
    cb(null, true);
  },
};

const TIPOS_VALIDOS = new Set<TipoDocumentoRedaccion>(['instancia', 'carta', 'informe', 'otro']);

/**
 * Espacio de redacción libre con IA: redacta instancias, cartas e informes
 * desde cero, sin depender de ningún expediente, cliente ni plantilla del
 * catálogo fijo -- para cuando lo que el abogado necesita no encaja en un
 * formulario de campos predefinidos. No guarda nada por sí solo.
 */
@Controller('redaccion')
export class RedaccionController {
  constructor(
    private readonly redaccionService: RedaccionService,
    private readonly redaccionDocxService: RedaccionDocxService,
  ) {}

  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @Post('generar')
  @UseInterceptors(FilesInterceptor('documentos', 5, opcionesMulterReferencias))
  async generar(
    @UploadedFiles() archivos: Express.Multer.File[],
    @Body('tipoDocumento') tipoDocumento: string,
    @Body('instrucciones') instrucciones: string,
  ) {
    if (!TIPOS_VALIDOS.has(tipoDocumento as TipoDocumentoRedaccion)) {
      throw new BadRequestException('Tipo de documento no reconocido.');
    }
    const referencias = (archivos ?? []).map((archivo) => ({ buffer: archivo.buffer, mimeType: archivo.mimetype }));
    return this.redaccionService.generarDocumento(tipoDocumento as TipoDocumentoRedaccion, instrucciones, referencias);
  }

  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @Post('exportar-docx')
  async exportarDocx(@Body() datos: ExportarDocxDto, @Res() res: Response) {
    const buffer = await this.redaccionDocxService.generarDocx(datos.tipoDocumento, datos.texto);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${datos.tipoDocumento}.docx"`);
    res.send(buffer);
  }
}
