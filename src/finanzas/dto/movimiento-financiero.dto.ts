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

// Los gastos/ingresos registrados a mano pueden variar (un monto se
// corrige, se reclasifica de categoría, etc.) -- por eso son editables, a
// diferencia de los ingresos que vienen de un pago de factura (esos se
// corrigen desde Facturas).
export class UpdateMovimientoFinancieroDto {
  @IsOptional()
  @IsUUID()
  categoriaId?: string;

  @IsOptional()
  @IsString()
  concepto?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  monto?: number;

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
