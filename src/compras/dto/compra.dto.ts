import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateCompraDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  proveedorNombre: string;

  /** RNC (9 dígitos) o cédula (11); se aceptan guiones y espacios. */
  @IsString()
  proveedorIdentificacion: string;

  @IsString()
  ncf: string;

  @IsOptional()
  @IsString()
  ncfModificado?: string;

  @IsDateString()
  fechaComprobante: string;

  @IsOptional()
  @IsDateString()
  fechaPago?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(11)
  tipoBienesServicios: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7)
  formaPago?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  montoServicios: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  montoBienes: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  itbisFacturado: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  itbisAlCosto?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  itbisRetenido?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(9)
  tipoRetencionIsr?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  retencionRenta?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  isc?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  otrosImpuestos?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  propinaLegal?: number;

  /** Total que dice la factura; si no cuadra con la suma se rechaza. */
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  total: number;

  @IsOptional()
  @IsIn(['DOP', 'USD', 'EUR'])
  moneda?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  concepto?: string;

  @IsOptional()
  @IsUUID()
  expedienteId?: string;

  /** 'lectura_ia' cuando los datos vinieron de la lectura asistida y se revisaron. */
  @IsOptional()
  @IsIn(['manual', 'lectura_ia'])
  origen?: 'manual' | 'lectura_ia';
}

export class AnularCompraDto {
  @IsString()
  @MinLength(5, { message: 'Escribe el motivo de la anulación (mínimo 5 caracteres).' })
  @MaxLength(500)
  motivo: string;
}
