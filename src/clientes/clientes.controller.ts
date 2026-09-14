import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Patch,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { ClientesService } from './clientes.service.js';
import { ExtraccionIdentidadService } from './extraccion-identidad.service.js';
import { CreateClienteDto, UpdateClienteDto } from './dto/create-cliente.dto.js';
import { TipoCliente } from '../common/enums/index.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Throttle } from '@nestjs/throttler';

// Fotos o PDFs de cédula/pasaporte -- no es una subida de documento del
// expediente (eso es el módulo `documentos`), por eso tiene su propia
// validación más estrecha en vez de reusar la de DocumentosController.
const TAMANO_MAXIMO_IDENTIDAD_BYTES = 15 * 1024 * 1024; // 15 MB
const EXTENSIONES_IDENTIDAD_PERMITIDAS = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.heic', '.tif', '.tiff']);
const TIPOS_MIME_IDENTIDAD_PERMITIDOS = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/tiff',
  'application/octet-stream',
]);

const opcionesMulterIdentidad = {
  storage: memoryStorage(),
  limits: { fileSize: TAMANO_MAXIMO_IDENTIDAD_BYTES },
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
    const extension = extname(file.originalname).toLowerCase();
    if (!EXTENSIONES_IDENTIDAD_PERMITIDAS.has(extension) || !TIPOS_MIME_IDENTIDAD_PERMITIDOS.has(file.mimetype)) {
      cb(new BadRequestException('Formato no permitido. Sube una foto (JPG, PNG, HEIC) o un PDF de la cédula o pasaporte.'), false);
      return;
    }
    cb(null, true);
  },
};

@Controller('clientes')
export class ClientesController {
  constructor(
    private readonly clientesService: ClientesService,
    private readonly extraccionIdentidadService: ExtraccionIdentidadService,
  ) {}

  /**
   * Lee una foto o PDF de cédula/pasaporte con IA y devuelve los datos
   * detectados para pre-llenar el formulario de "Nuevo cliente" -- no crea
   * ni modifica ningún cliente. El usuario siempre revisa/corrige antes de
   * guardar (sección "crear cliente a partir de foto de cédula" del
   * requerimiento original).
   */
  // Limite propio (aparte del global de 100/min): cada llamada cuesta una
  // petición real a la API de Anthropic -- sin esto, una cuenta interna
  // comprometida (o solo un error del cliente) podria generar un gasto
  // grande sin que nadie lo note (auditoría 14-sep-2026).
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @Post('extraer-identidad')
  @UseInterceptors(FileInterceptor('documento', opcionesMulterIdentidad))
  extraerIdentidad(@UploadedFile() archivo: Express.Multer.File) {
    if (!archivo) {
      throw new BadRequestException('No se recibió ningún archivo.');
    }
    return this.extraccionIdentidadService.extraerDeArchivo(archivo.buffer, archivo.mimetype);
  }

  @Get()
  buscar(
    @Query('q') q?: string,
    @Query('tipo') tipo?: TipoCliente,
    @Query('pagina') pagina?: string,
    @Query('porPagina') porPagina?: string,
  ) {
    if (pagina !== undefined || porPagina !== undefined) {
      return this.clientesService.buscar(q, tipo, { pagina, porPagina });
    }
    return this.clientesService.buscar(q, tipo);
  }

  @Get(':id')
  obtener(@Param('id') id: string) {
    return this.clientesService.obtenerPorId(id);
  }

  /**
   * Crea un cliente. Si se detectan posibles duplicados, la respuesta trae
   * `duplicados` en vez de `cliente`, con código 200 (no es un error, es una
   * advertencia para que el usuario decida). Para forzar la creación pese a
   * la coincidencia, se reenvía la misma solicitud con ?forzar=true.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  crear(
    @Body() dto: CreateClienteDto,
    @Query('forzar') forzar: string | undefined,
    @CurrentUser('sub') usuarioId: string,
  ) {
    return this.clientesService.crear(dto, {
      forzarPeseADuplicado: forzar === 'true',
      usuarioId,
    });
  }

  @Patch(':id')
  actualizar(
    @Param('id') id: string,
    @Body() dto: UpdateClienteDto,
    @CurrentUser('sub') usuarioId: string,
  ) {
    return this.clientesService.actualizar(id, dto, usuarioId);
  }

  @Get(':id/historial')
  historial(@Param('id') id: string) {
    return this.clientesService.historial(id);
  }
}
