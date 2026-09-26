import { IsEnum, IsOptional, IsString } from 'class-validator';
import { MateriaJuridica } from '../../common/enums/index.js';

export class CrearBlogPostDto {
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
}
