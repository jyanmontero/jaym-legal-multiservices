import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { BadRequestException } from '@nestjs/common';
import { MarketingService } from './marketing.service.js';
import { CrearAnuncioDto } from './dto/crear-anuncio.dto.js';
import { ActualizarAnuncioDto } from './dto/actualizar-anuncio.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { EstadoAnuncioPropiedad, ROLES_CON_ACCESO_MARKETING } from '../common/enums/index.js';

const EXTENSIONES_IMAGEN = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const TIPOS_MIME_IMAGEN = new Set(['image/jpeg', 'image/png', 'image/webp']);

const opcionesMulterFotos = {
  storage: memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB por foto
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (error: Error | null, aceptar: boolean) => void) => {
    const extension = extname(file.originalname).toLowerCase();
    if (!EXTENSIONES_IMAGEN.has(extension) || !TIPOS_MIME_IMAGEN.has(file.mimetype)) {
      cb(new BadRequestException('Solo se aceptan fotos JPG, PNG o WEBP.'), false);
      return;
    }
    cb(null, true);
  },
};

// Este módulo es para JAYM Portal Inmobiliario (negocio de bienes raíces),
// no para el despacho legal -- por eso se restringe solo a
// superadministrador (ver ROLES_CON_ACCESO_MARKETING), en vez de usar los
// roles/permisos del bufete.
@Controller('marketing')
@UseGuards(RolesGuard)
@Roles(...ROLES_CON_ACCESO_MARKETING)
export class MarketingController {
  constructor(private readonly marketingService: MarketingService) {}

  @Get('meta/estado')
  estadoMeta() {
    return { credencialesConfiguradas: this.marketingService.credencialesMetaConfiguradas() };
  }

  @Post('anuncios')
  @UseInterceptors(FilesInterceptor('fotos', 10, opcionesMulterFotos))
  crear(
    @Body() dto: CrearAnuncioDto,
    @UploadedFiles() fotos: Express.Multer.File[],
    @CurrentUser('sub') usuarioId: string,
  ) {
    return this.marketingService.crear(dto, fotos, usuarioId);
  }

  @Get('anuncios')
  listar(@Query('estado') estado?: EstadoAnuncioPropiedad) {
    return this.marketingService.listar(estado);
  }

  @Get('anuncios/:id')
  obtener(@Param('id') id: string) {
    return this.marketingService.obtener(id);
  }

  @Get('anuncios/:id/fotos')
  fotos(@Param('id') id: string) {
    return this.marketingService.urlsFotos(id);
  }

  @Patch('anuncios/:id')
  actualizar(@Param('id') id: string, @Body() dto: ActualizarAnuncioDto) {
    return this.marketingService.actualizar(id, dto);
  }

  @Post('anuncios/:id/regenerar-texto')
  regenerarTexto(@Param('id') id: string) {
    return this.marketingService.regenerarTexto(id);
  }

  @Post('anuncios/:id/publicar')
  publicar(@Param('id') id: string) {
    return this.marketingService.publicar(id);
  }

  @Delete('anuncios/:id')
  eliminar(@Param('id') id: string) {
    return this.marketingService.eliminar(id);
  }
}
