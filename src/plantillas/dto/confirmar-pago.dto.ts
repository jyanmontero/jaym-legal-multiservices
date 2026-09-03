import { IsOptional, IsString } from 'class-validator';

export class ConfirmarPagoDto {
  // Ej. últimos dígitos de la transferencia, o "efectivo en oficina".
  @IsOptional()
  @IsString()
  referenciaPago?: string;
}
