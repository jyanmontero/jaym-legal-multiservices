import { IsNumber, IsEnum, IsOptional, IsString, IsDateString, Min } from 'class-validator';
import { MetodoPago } from '../../common/enums/index.js';

export class CreatePagoDto {
  @IsNumber()
  @Min(0.01)
  monto: number;

  @IsEnum(MetodoPago)
  metodo: MetodoPago;

  @IsOptional()
  @IsString()
  referencia?: string;

  @IsOptional()
  @IsDateString()
  fecha?: string;

  @IsOptional()
  @IsString()
  notas?: string;
}
