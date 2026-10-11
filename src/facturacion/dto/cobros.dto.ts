import { IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export const TIPOS_COBRO = ['cotizacion', 'factura', 'recordatorio'] as const;
export type TipoCobro = (typeof TIPOS_COBRO)[number];

export class EnviarCobroCorreoDto {
  @IsIn(TIPOS_COBRO) tipo: TipoCobro;
  @IsUUID() id: string;
  @IsString() @IsNotEmpty() @MaxLength(500) para: string;
  @IsString() @IsNotEmpty() @MaxLength(200) asunto: string;
  @IsString() @IsNotEmpty() @MaxLength(8000) mensaje: string;
}

export class RegistrarWhatsappDto {
  @IsIn(TIPOS_COBRO) tipo: TipoCobro;
  @IsUUID() id: string;
  @IsString() @IsNotEmpty() @MaxLength(40) telefono: string;
  @IsString() @IsNotEmpty() @MaxLength(4000) mensaje: string;
}

export class HistorialCobrosQueryDto {
  @IsOptional() @IsUUID() facturaId?: string;
  @IsOptional() @IsUUID() cotizacionId?: string;
  @IsOptional() @IsUUID() clienteId?: string;
}
