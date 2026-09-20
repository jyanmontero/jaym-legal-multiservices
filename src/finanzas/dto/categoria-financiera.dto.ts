import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { TipoMovimientoFinanciero } from '../../common/enums/index.js';

export class CreateCategoriaFinancieraDto {
  @IsString()
  nombre: string;

  @IsEnum(TipoMovimientoFinanciero)
  tipo: TipoMovimientoFinanciero;

  @IsOptional()
  @IsNumber()
  @Min(0)
  presupuestoMensual?: number;
}

export class UpdateCategoriaFinancieraDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  presupuestoMensual?: number;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}
