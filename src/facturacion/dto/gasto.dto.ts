import { IsNumber, IsOptional, IsString, IsDateString, Min, IsBoolean, IsUUID } from 'class-validator';

export class CreateGastoDto {
  @IsUUID()
  expedienteId: string;

  @IsString()
  concepto: string;

  @IsNumber()
  @Min(0.01)
  monto: number;

  @IsOptional()
  @IsDateString()
  fecha?: string;

  @IsOptional()
  @IsBoolean()
  facturadoAlCliente?: boolean;

  @IsOptional()
  @IsString()
  notas?: string;
}
