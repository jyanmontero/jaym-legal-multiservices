import {
  IsUUID,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ItemFacturableDto } from './item-facturable.dto.js';
import { EstadoCotizacion } from '../../common/enums/index.js';

export class CreateCotizacionDto {
  @IsUUID()
  clienteId: string;

  @IsOptional()
  @IsUUID()
  expedienteId?: string;

  @IsString()
  concepto: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'La cotización debe tener al menos una línea' })
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
  validaHasta?: string;

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
  direccionFacturacion?: string;

  @IsOptional()
  @IsString()
  direccionEnvio?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  costoEnvio?: number;
}

export class CambiarEstadoCotizacionDto {
  @IsEnum(EstadoCotizacion)
  estado: EstadoCotizacion;
}
