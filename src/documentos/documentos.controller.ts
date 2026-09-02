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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import type { Response } from 'express';
import { DocumentosService, CARPETA_ALMACENAMIENTO } from './documentos.service.js';
import { SubirDocumentoDto, NuevaVersionDocumentoDto } from './dto/subir-documento.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { RolUsuario } from '../common/enums/index.js';

// Límite conservador para un despacho pequeño; ajustar según necesidad real.
const TAMANO_MAXIMO_BYTES = 25 * 1024 * 1024; // 25 MB

const opcionesMulter = {
  storage: diskStorage({
    destination: CARPETA_ALMACENAMIENTO,
    filename: (_req, file, cb) => {
      cb(null, `${randomUUID()}${extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: TAMANO_MAXIMO_BYTES },
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
    @Query('expedienteId') expedienteId?: string,
    @Query('clienteId') clienteId?: string,
    @Query('categoria') categoria?: string,
  ) {
    return this.documentosService.listar({ expedienteId, clienteId, categoria });
  }

  @Get('papelera')
  listarPapelera() {
    return this.documentosService.listarPapelera();
  }

  @Get(':id')
  async obtener(@Param('id') id: string, @CurrentUser('rol') rol: RolUsuario) {
    const documento = await this.documentosService.obtenerPorId(id);
    await this.documentosService.verificarAcceso(documento, rol, 'ver');
    return documento;
  }

  @Get(':id/versiones')
  listarVersiones(@Param('id') id: string) {
    return this.documentosService.listarVersiones(id);
  }

  @Get(':id/descargar')
  async descargar(
    @Param('id') id: string,
    @CurrentUser('rol') rol: RolUsuario,
    @Res() res: Response,
  ) {
    const documento = await this.documentosService.obtenerPorId(id);
    await this.documentosService.verificarAcceso(documento, rol, 'descargar');
    const ruta = await this.documentosService.rutaFisica(documento);
    return res.download(ruta, documento.nombreArchivo);
  }

  @Delete(':id')
  eliminar(@Param('id') id: string, @CurrentUser('sub') usuarioId: string) {
    return this.documentosService.eliminar(id, usuarioId);
  }

  @Post(':id/restaurar')
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
