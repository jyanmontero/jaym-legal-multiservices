import {
  BadRequestException,
  Controller,
  ForbiddenException,
  NotFoundException,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { Throttle } from '@nestjs/throttler';
import { AnalisisJuridicoService } from './analisis-juridico.service.js';
import { Expediente } from '../expedientes/expediente.entity.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtPayloadUsuario } from '../auth/decorators/current-user.decorator.js';
import { RolUsuario, ROLES_CON_VISIBILIDAD_TOTAL_EXPEDIENTES } from '../common/enums/index.js';

// Mismo criterio de tamaño/formato que la extracción de identidad de
// clientes -- no es una subida de documento del expediente (eso sigue
// siendo el módulo `documentos`), este análisis nunca guarda el archivo.
const TAMANO_MAXIMO_ANALISIS_BYTES = 20 * 1024 * 1024; // 20 MB (sentencias pueden ser PDFs de varias páginas)
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

const opcionesMulterAnalisis = {
  storage: memoryStorage(),
  limits: { fileSize: TAMANO_MAXIMO_ANALISIS_BYTES },
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
    const extension = extname(file.originalname).toLowerCase();
    if (!EXTENSIONES_PERMITIDAS.has(extension) || !TIPOS_MIME_PERMITIDOS.has(file.mimetype)) {
      cb(new BadRequestException('Formato no permitido. Sube una foto/escaneo (JPG, PNG, HEIC) o un PDF del documento.'), false);
      return;
    }
    cb(null, true);
  },
};

/**
 * Analiza un documento jurídico (sentencia, resolución, notificación,
 * informe, etc.) dentro del contexto de un expediente. No guarda nada por
 * sí solo -- devuelve el análisis para que el abogado lo revise y, si
 * quiere aplicarlo, use los endpoints normales de seguimiento
 * (POST /expedientes/:id/seguimiento) y/o actualización del expediente
 * (PATCH /expedientes/:id) desde el frontend.
 */
@Controller('expedientes/:expedienteId/analizar-documento')
export class AnalisisJuridicoController {
  constructor(
    private readonly analisisJuridicoService: AnalisisJuridicoService,
    // Inyectado directamente (no se importa ExpedientesModule) para evitar
    // una dependencia circular -- mismo patrón que SeguimientoController.
    @InjectRepository(Expediente) private readonly expedienteRepo: Repository<Expediente>,
  ) {}

  private async verificarAcceso(expedienteId: string, usuario: JwtPayloadUsuario): Promise<void> {
    const rol = usuario.rol as RolUsuario;
    if (ROLES_CON_VISIBILIDAD_TOTAL_EXPEDIENTES.includes(rol)) return;
    const expediente = await this.expedienteRepo.findOne({ where: { id: expedienteId } });
    if (!expediente) throw new NotFoundException('Expediente no encontrado');
    if (expediente.abogadoResponsableId && expediente.abogadoResponsableId !== usuario.sub) {
      throw new ForbiddenException('Este expediente está asignado a otro abogado responsable.');
    }
  }

  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @Post()
  @UseInterceptors(FileInterceptor('documento', opcionesMulterAnalisis))
  async analizar(
    @Param('expedienteId') expedienteId: string,
    @UploadedFile() archivo: Express.Multer.File,
    @CurrentUser() usuario: JwtPayloadUsuario,
  ) {
    await this.verificarAcceso(expedienteId, usuario);
    if (!archivo) {
      throw new BadRequestException('No se recibió ningún archivo.');
    }
    return this.analisisJuridicoService.analizarDocumento(archivo.buffer, archivo.mimetype);
  }
}
