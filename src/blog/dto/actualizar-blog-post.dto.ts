import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { MateriaJuridica } from '../../common/enums/index.js';

export class ActualizarBlogPostDto {
  @IsOptional()
  @IsString()
  titulo?: string;

  @IsOptional()
  @IsString()
  contenidoHtml?: string;

  @IsOptional()
  @IsString()
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
