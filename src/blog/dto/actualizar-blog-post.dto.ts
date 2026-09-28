import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { MateriaJuridica } from '../../common/enums/index.js';

export class ActualizarBlogPostDto {
  @IsOptional()
  @IsString()
  titulo?: string;

  @IsOptional()
  @IsString()
  contenidoHtml?: string;

  // Ver crear-blog-post.dto.ts: el extracto es la bajada/meta descripción de
  // la tarjeta en el listado del blog -- debe ser breve, nunca el artículo completo.
  @IsOptional()
  @IsString()
  @MaxLength(300, { message: 'El extracto debe ser un resumen breve (máximo 300 caracteres) -- no el artículo completo.' })
  extracto?: string;

  @IsOptional()
  @IsEnum(MateriaJuridica)
  areaPractica?: MateriaJuridica;

  @IsOptional()
  @IsString()
  temaOriginal?: string;

  // Fecha (YYYY-MM-DD) en que debe publicarse solo. Enviarla vacía/null
  // "desprograma" el blog (vuelve a borrador) -- ver blog.service.ts.
  @IsOptional()
  @IsDateString()
  fechaProgramada?: string;
}
