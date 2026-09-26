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
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { BlogService } from './blog.service.js';
import { CrearBlogPostDto } from './dto/crear-blog-post.dto.js';
import { ActualizarBlogPostDto } from './dto/actualizar-blog-post.dto.js';
import { GenerarBorradorBlogDto } from './dto/generar-borrador-blog.dto.js';
import { ProgramarBlogPostDto } from './dto/programar-blog-post.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { EstadoBlogPost, ROLES_CON_ACCESO_BLOG } from '../common/enums/index.js';

const EXTENSIONES_IMAGEN = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const TIPOS_MIME_IMAGEN = new Set(['image/jpeg', 'image/png', 'image/webp']);

const opcionesMulterImagen = {
  storage: memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (error: Error | null, aceptar: boolean) => void) => {
    const extension = extname(file.originalname).toLowerCase();
    if (!EXTENSIONES_IMAGEN.has(extension) || !TIPOS_MIME_IMAGEN.has(file.mimetype)) {
      cb(new BadRequestException('Solo se aceptan imágenes JPG, PNG o WEBP.'), false);
      return;
    }
    cb(null, true);
  },
};

@Controller('blog')
@UseGuards(RolesGuard)
@Roles(...ROLES_CON_ACCESO_BLOG)
export class BlogController {
  constructor(private readonly blogService: BlogService) {}

  @Get('estado')
  estado() {
    return { credencialesConfiguradas: this.blogService.credencialesConfiguradas() };
  }

  @Post()
  crear(@Body() dto: CrearBlogPostDto, @CurrentUser('sub') usuarioId: string) {
    return this.blogService.crear(dto, usuarioId);
  }

  @Get()
  listar(@Query('estado') estado?: EstadoBlogPost) {
    return this.blogService.listar(estado);
  }

  @Get(':id')
  obtener(@Param('id') id: string) {
    return this.blogService.obtener(id);
  }

  @Patch(':id')
  actualizar(@Param('id') id: string, @Body() dto: ActualizarBlogPostDto) {
    return this.blogService.actualizar(id, dto);
  }

  @Get(':id/imagen-destacada')
  async urlImagen(@Param('id') id: string) {
    return { url: await this.blogService.urlImagenDestacada(id) };
  }

  @Post(':id/imagen-destacada')
  @UseInterceptors(FileInterceptor('imagen', opcionesMulterImagen))
  subirImagen(@Param('id') id: string, @UploadedFile() imagen: Express.Multer.File) {
    if (!imagen) throw new BadRequestException('Falta la imagen.');
    return this.blogService.subirImagenDestacada(id, imagen);
  }

  @Post(':id/generar-borrador')
  generarBorrador(@Param('id') id: string, @Body() dto: GenerarBorradorBlogDto) {
    return this.blogService.generarBorrador(id, dto);
  }

  @Post(':id/programar')
  programar(@Param('id') id: string, @Body() dto: ProgramarBlogPostDto) {
    return this.blogService.programar(id, dto.fechaProgramada);
  }

  @Post(':id/publicar-ahora')
  publicarAhora(@Param('id') id: string) {
    return this.blogService.publicarAhora(id);
  }

  @Delete(':id')
  eliminar(@Param('id') id: string) {
    return this.blogService.eliminar(id);
  }
}
