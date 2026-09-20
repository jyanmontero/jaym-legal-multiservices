import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

// Edición antes de publicar: datos de la propiedad y/o el texto ya
// generado (el abogado -- o en este caso, Joseph -- siempre revisa y
// puede corregir antes de que salga a Facebook/Instagram/WhatsApp).
export class ActualizarAnuncioDto {
  @IsOptional()
  @IsString()
  titulo?: string;

  @IsOptional()
  @IsString()
  zona?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  habitaciones?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  banos?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  metrosCuadrados?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  precio?: number;

  @IsOptional()
  @IsString()
  moneda?: string;

  @IsOptional()
  @IsString()
  notas?: string;

  @IsOptional()
  @IsString()
  contacto?: string;

  @IsOptional()
  @IsString()
  textoAnuncio?: string;

  @IsOptional()
  @IsString()
  mensajeWhatsapp?: string;
}
