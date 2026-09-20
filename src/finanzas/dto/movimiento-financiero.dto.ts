import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { TipoMovimientoFinanciero, MetodoPago } from '../../common/enums/index.js';

export class CreateMovimientoFinancieroDto {
  @IsEnum(TipoMovimientoFinanciero)
  tipo: TipoMovimientoFinanciero;

  @IsUUID()
  categoriaId: string;

  @IsString()
  concepto: string;

  @IsNumber()
  @Min(0.01)
  monto: number;

  @IsOptional()
  @IsDateString()
  fecha?: string;

  @IsOptional()
  @IsEnum(MetodoPago)
  metodoPago?: MetodoPago;

  @IsOptional()
  @IsString()
  notas?: string;
}
