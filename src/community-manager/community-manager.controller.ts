import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { ROLES_CON_ACCESO_BLOG } from '../common/enums/index.js';
import { CommunityManagerService } from './community-manager.service.js';
import type { EstadoPublicacionRedes } from './publicacion-redes.entity.js';
import {
  ActualizarPublicacionDto,
  CrearPublicacionDto,
  DesdeBlogDto,
  GenerarPublicacionDto,
  MarcarManualDto,
  ProgramarPublicacionDto,
  RegenerarPublicacionDto,
  SugerirSemanaDto,
} from './dto/community-manager.dto.js';

const EXTENSIONES_IMAGEN = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const TIPOS_MIME_IMAGEN = new Set(['image/jpeg', 'image/png', 'image/webp']);

const opcionesMulterImagen = {
  storage: memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (error: Error | null, aceptar: boolean) => void) => {
    const extension = extname(file.originalname).toLowerCase();
    if (!EXTENSIONES_IMAGEN.has(extension) || !TIPOS_MIME_IMAGEN.has(file.mimetype)) {
      cb(new BadRequestException('Solo se aceptan imágenes JPG, PNG o WEBP.'), false);
      return;
    }
    cb(null, true);
  },
};

// Mismo acceso que el blog: superadministrador y abogado administrador.
@Controller('community-manager')
@UseGuards(RolesGuard)
@Roles(...ROLES_CON_ACCESO_BLOG)
export class CommunityManagerController {
  constructor(private readonly servicio: CommunityManagerService) {}

  @Get('estado')
  estado() {
    return { conexiones: this.servicio.conexiones() };
  }

  @Get('ficha')
  ficha() {
    return this.servicio.ficha();
  }

  @Get('publicaciones')
  listar(@Query('estado') estado?: EstadoPublicacionRedes) {
    return this.servicio.listar(estado);
  }

  @Post('publicaciones')
  crear(@Body() dto: CrearPublicacionDto, @CurrentUser('sub') usuarioId: string) {
    return this.servicio.crearManual(dto, usuarioId);
  }

  @Post('publicaciones/generar')
  generar(@Body() dto: GenerarPublicacionDto, @CurrentUser('sub') usuarioId: string) {
    return this.servicio.generar(dto, usuarioId);
  }

  @Post('publicaciones/sugerir-semana')
  sugerirSemana(@Body() dto: SugerirSemanaDto, @CurrentUser('sub') usuarioId: string) {
    return this.servicio.sugerirSemana(dto, usuarioId);
  }

  @Post('publicaciones/desde-blog/:blogId')
  desdeBlog(@Param('blogId') blogId: string, @Body() dto: DesdeBlogDto, @CurrentUser('sub') usuarioId: string) {
    return this.servicio.desdeBlog(blogId, dto.redes, usuarioId);
  }

  @Get('publicaciones/:id')
  obtener(@Param('id') id: string) {
    return this.servicio.obtener(id);
  }

  @Patch('publicaciones/:id')
  actualizar(@Param('id') id: string, @Body() dto: ActualizarPublicacionDto) {
    return this.servicio.actualizar(id, dto);
  }

  @Post('publicaciones/:id/regenerar')
  regenerar(@Param('id') id: string, @Body() dto: RegenerarPublicacionDto) {
    return this.servicio.regenerar(id, dto.instrucciones);
  }

  @Get('publicaciones/:id/imagen')
  async urlImagen(@Param('id') id: string) {
    return { url: await this.servicio.urlImagen(id) };
  }

  @Post('publicaciones/:id/imagen')
  @UseInterceptors(FileInterceptor('imagen', opcionesMulterImagen))
  subirImagen(@Param('id') id: string, @UploadedFile() imagen: Express.Multer.File) {
    if (!imagen) throw new BadRequestException('Falta la imagen.');
    return this.servicio.subirImagen(id, imagen);
  }

  @Post('publicaciones/:id/aprobar-y-programar')
  aprobarYProgramar(
    @Param('id') id: string,
    @Body() dto: ProgramarPublicacionDto,
    @CurrentUser('sub') usuarioId: string,
  ) {
    return this.servicio.aprobarYProgramar(id, dto.fechaProgramada, usuarioId);
  }

  @Post('publicaciones/:id/aprobar-y-publicar')
  aprobarYPublicar(@Param('id') id: string, @CurrentUser('sub') usuarioId: string) {
    return this.servicio.aprobarYPublicar(id, usuarioId);
  }

  @Post('publicaciones/:id/reintentar')
  reintentar(@Param('id') id: string) {
    return this.servicio.reintentar(id);
  }

  @Post('publicaciones/:id/marcar-manual')
  marcarManual(@Param('id') id: string, @Body() dto: MarcarManualDto) {
    return this.servicio.marcarManual(id, dto.red, dto.enlace);
  }

  @Delete('publicaciones/:id')
  eliminar(@Param('id') id: string) {
    return this.servicio.eliminar(id);
  }
}
