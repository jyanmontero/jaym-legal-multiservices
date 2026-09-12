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
import { CreateClienteDto } from '../../clientes/dto/create-cliente.dto.js';
import { EstadoCotizacion } from '../../common/enums/index.js';

export class CreateCotizacionDto {
  // Uno de los dos es obligatorio: o se cotiza a un cliente ya existente
  // (clienteId) o se manda la ficha de un cliente nuevo (clienteNuevo) y el
  // backend lo crea antes de crear la cotización — FacturacionService valida
  // que venga exactamente uno de los dos.
  @IsOptional()
  @IsUUID()
  clienteId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateClienteDto)
  clienteNuevo?: CreateClienteDto;

  // Igual que ClientesController: si ClientesService.crear() detecta un
  // posible duplicado (misma cédula/pasaporte/rnc/correo), la primera
  // llamada no crea nada y devuelve `duplicados` para que el usuario decida;
  // si confirma, la interfaz reenvía la misma solicitud con esto en true.
  @IsOptional()
  @IsBoolean()
  forzarClienteDuplicado?: boolean;

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
