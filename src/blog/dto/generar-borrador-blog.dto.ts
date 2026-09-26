import { IsEnum, IsOptional, IsString } from 'class-validator';
import { MateriaJuridica } from '../../common/enums/index.js';

export class GenerarBorradorBlogDto {
  // Tema o palabra clave que describe de qué debe tratar el artículo, por
  // ejemplo "cómo tramitar un divorcio en República Dominicana" o "requisitos
  // para registrar una SRL". Es lo único que la IA necesita para redactar.
  @IsString()
  tema: string;

  @IsOptional()
  @IsEnum(MateriaJuridica)
  areaPractica?: MateriaJuridica;
}
