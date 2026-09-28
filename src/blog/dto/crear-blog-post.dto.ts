import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { MateriaJuridica } from '../../common/enums/index.js';

export class CrearBlogPostDto {
  @IsOptional()
  @IsString()
  titulo?: string;

  @IsOptional()
  @IsString()
  contenidoHtml?: string;

  // Límite corto a propósito: el extracto es la bajada/meta descripción que
  // se muestra en la tarjeta del blog en jaymlegalmultiservices.com/blog/ --
  // si se pega aquí el artículo completo (como pasó con el post de SeNaSa),
  // la tarjeta sale como un bloque de texto sin imagen ni orden visual.
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
}
