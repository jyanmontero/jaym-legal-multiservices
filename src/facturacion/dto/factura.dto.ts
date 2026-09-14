import {
  IsUUID,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsBoolean,
  IsDateString,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ItemFacturableDto } from './item-facturable.dto.js';

export class CreateFacturaDto {
  @IsUUID()
  clienteId: string;

  @IsOptional()
  @IsUUID()
  expedienteId?: string;

  @IsOptional()
  @IsString()
  concepto?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'La factura debe tener al menos una línea' })
  @ValidateNested({ each: true })
  @Type(() => ItemFacturableDto)
  items: ItemFacturableDto[];

  @IsOptional()
  @IsBoolean()
  aplicaItbis?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  descuento?: number;

  @IsOptional()
  @IsDateString()
  fechaEmision?: string;

  @IsOptional()
  @IsDateString()
  fechaVencimiento?: string;

  @IsOptional()
  @IsString()
  ncf?: string;

  @IsOptional()
  @IsString()
  notas?: string;

  @IsOptional()
  @IsString()
  condicionesPago?: string;

  @IsOptional()
  @IsString()
  numeroOrdenCompra?: string;

  @IsOptional()
  @IsString()
  vendedor?: string;

  @IsOptional()
  @IsString()
  enlacePago?: string;

  @IsOptional()
  @IsString()
  direccionFacturacion?: string;

  @IsOptional()
  @IsString()
  direccionEnvio?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  costoEnvio?: number;
}

// Edición de una factura ya guardada -- todos los campos opcionales, solo
// se actualizan los que vienen en el body. Reservado a SUPERADMINISTRADOR
// (ver FacturasController). No incluye clienteId/expedienteId (no se
// reasigna una factura ya emitida a otro cliente/expediente desde aquí) ni
// montoPagado/estado (esos son derivados de los pagos registrados -- ver
// FacturacionService.registrarPago/eliminarPago).
export class UpdateFacturaDto {
  @IsOptional()
  @IsString()
  concepto?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'La factura debe tener al menos una línea' })
  @ValidateNested({ each: true })
  @Type(() => ItemFacturableDto)
  items?: ItemFacturableDto[];

  @IsOptional()
  @IsBoolean()
  aplicaItbis?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  descuento?: number;

  @IsOptional()
  @IsDateString()
  fechaEmision?: string;

  @IsOptional()
  @IsDateString()
  fechaVencimiento?: string;

  @IsOptional()
  @IsString()
  ncf?: string;

  @IsOptional()
  @IsString()
  notas?: string;

  @IsOptional()
  @IsString()
  condicionesPago?: string;

  @IsOptional()
  @IsString()
  numeroOrdenCompra?: string;

  @IsOptional()
  @IsString()
  vendedor?: string;

  @IsOptional()
  @IsString()
  enlacePago?: string;

  @IsOptional()
  @IsString()
  direccionFacturacion?: string;

  @IsOptional()
  @IsString()
  direccionEnvio?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  costoEnvio?: number;
}
