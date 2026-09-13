import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  ParseFilePipeBuilder,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import type { Response } from 'express';
import { DocumentosService, CARPETA_ALMACENAMIENTO } from './documentos.service.js';
import { SubirDocumentoDto, NuevaVersionDocumentoDto } from './dto/subir-documento.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtPayloadUsuario } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { RolUsuario } from '../common/enums/index.js';

// Límite conservador para un despacho pequeño; ajustar según necesidad real.
const TAMANO_MAXIMO_BYTES = 25 * 1024 * 1024; // 25 MB

// Whitelist de lo que un despacho legal necesita subir de verdad: documentos
// de oficina, imágenes de evidencia/identificación y comprimidos para
// expedientes voluminosos. Se valida tanto la extensión como el tipo MIME
// que reporta el navegador -- ninguno de los dos es infalsificable por sí
// solo, pero juntos cierran el caso más simple (subir un .html o .svg con
// script embebido, un .exe renombrado, etc.) que hoy pasa sin ningún control
// (hallazgo de la auditoría de resistencia y seguridad).
const EXTENSIONES_PERMITIDAS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods',
  '.txt', '.csv', '.rtf',
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.tif', '.tiff', '.bmp', '.heic',
  '.zip',
]);

const TIPOS_MIME_PERMITIDOS = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'text/plain',
  'text/csv',
  'application/rtf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/tiff',
  'image/bmp',
  'image/heic',
  'application/zip',
  'application/x-zip-compressed',
  'application/octet-stream', // fallback común de algunos navegadores/OS para .heic, .zip, etc.
]);

const opcionesMulter = {
  storage: diskStorage({
    destination: CARPETA_ALMACENAMIENTO,
    filename: (_req, file, cb) => {
      cb(null, `${randomUUID()}${extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: TAMANO_MAXIMO_BYTES },
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
    const extension = extname(file.originalname).toLowerCase();
    if (!EXTENSIONES_PERMITIDAS.has(extension) || !TIPOS_MIME_PERMITIDOS.has(file.mimetype)) {
      cb(
        new BadRequestException(
          `Tipo de archivo no permitido (${extension || 'sin extensión'} / ${file.mimetype}). Formatos aceptados: documentos de oficina, PDF, imágenes comunes y ZIP.`,
        ),
        false,
      );
      return;
    }
    cb(null, true);
  },
};

@Controller('documentos')
export class DocumentosController {
  constructor(private readonly documentosService: DocumentosService) {}

  @Post()
  @UseInterceptors(FileInterceptor('archivo', opcionesMulter))
  subir(
    @Body() dto: SubirDocumentoDto,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .build({ fileIsRequired: true, errorHttpStatusCode: HttpStatus.BAD_REQUEST }),
    )
    archivo: Express.Multer.File,
    @CurrentUser('sub') usuarioId: string,
  ) {
    return this.documentosService.subir(dto, archivo, usuarioId);
  }

  @Post(':id/nueva-version')
  @UseInterceptors(FileInterceptor('archivo', opcionesMulter))
  subirNuevaVersion(
    @Param('id') id: string,
    @Body() dto: NuevaVersionDocumentoDto,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .build({ fileIsRequired: true, errorHttpStatusCode: HttpStatus.BAD_REQUEST }),
    )
    archivo: Express.Multer.File,
    @CurrentUser('sub') usuarioId: string,
  ) {
    return this.documentosService.subirNuevaVersion(id, dto, archivo, usuarioId);
  }

  @Get()
  listar(
    @CurrentUser() usuario: JwtPayloadUsuario,
    @Query('expedienteId') expedienteId?: string,
    @Query('clienteId') clienteId?: string,
    @Query('categoria') categoria?: string,
    @Query('pagina') pagina?: string,
    @Query('porPagina') porPagina?: string,
  ) {
    return this.documentosService.listar(
      { expedienteId, clienteId, categoria },
      { id: usuario.sub, rol: usuario.rol as RolUsuario },
      { pagina, porPagina },
    );
  }

  @Get('papelera')
  listarPapelera() {
    return this.documentosService.listarPapelera();
  }

  @Get(':id')
  async obtener(@Param('id') id: string, @CurrentUser() usuario: JwtPayloadUsuario) {
    const documento = await this.documentosService.obtenerPorId(id);
    const usuarioActual = { id: usuario.sub, rol: usuario.rol as RolUsuario };
    await this.documentosService.verificarVisibilidadDocumento(documento, usuarioActual);
    await this.documentosService.verificarAcceso(documento, usuarioActual.rol, 'ver');
    return documento;
  }

  @Get(':id/versiones')
  listarVersiones(@Param('id') id: string) {
    return this.documentosService.listarVersiones(id);
  }

  @Get(':id/descargar')
  async descargar(
    @Param('id') id: string,
    @CurrentUser() usuario: JwtPayloadUsuario,
    @Res() res: Response,
  ) {
    const documento = await this.documentosService.obtenerPorId(id);
    const usuarioActual = { id: usuario.sub, rol: usuario.rol as RolUsuario };
    await this.documentosService.verificarVisibilidadDocumento(documento, usuarioActual);
    await this.documentosService.verificarAcceso(documento, usuarioActual.rol, 'descargar');
    const ruta = await this.documentosService.rutaFisica(documento);
    return res.download(ruta, documento.nombreArchivo);
  }

  // Restringido a Superadministrador -- mismo criterio que
  // ExpedientesController.eliminar()/restaurar(): enviar un documento a la
  // papelera o sacarlo de ella no es un flujo de trabajo normal de un
  // abogado, y antes cualquier usuario autenticado podía hacerlo sin
  // importar su rol (hallazgo de la auditoría de resistencia y seguridad).
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.SUPERADMINISTRADOR)
  eliminar(@Param('id') id: string, @CurrentUser('sub') usuarioId: string) {
    return this.documentosService.eliminar(id, usuarioId);
  }

  @Post(':id/restaurar')
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.SUPERADMINISTRADOR)
  restaurar(@Param('id') id: string) {
    return this.documentosService.restaurar(id);
  }

  // Purga definitiva: irreversible, por eso restringida a Superadministrador.
  @Delete(':id/purgar')
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.SUPERADMINISTRADOR)
  async purgar(@Param('id') id: string) {
    await this.documentosService.purgarDefinitivamente(id);
    return { purgado: true };
  }
}
