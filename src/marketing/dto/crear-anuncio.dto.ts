import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

// Llega como multipart/form-data (junto con las fotos), por eso los
// números vienen como texto y se transforman explícitamente.
export class CrearAnuncioDto {
  @IsString()
  titulo: string;

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

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  precio: number;

  @IsOptional()
  @IsString()
  moneda?: string;

  @IsOptional()
  @IsString()
  notas?: string;

  @IsOptional()
  @IsString()
  contacto?: string;
}
