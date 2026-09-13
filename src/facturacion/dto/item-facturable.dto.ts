import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class ItemFacturableDto {
  @IsString()
  descripcion: string;

  @IsNumber()
  @Min(0.01)
  cantidad: number;

  @IsNumber()
  @Min(0)
  precioUnitario: number;

  @IsOptional()
  @IsString()
  codigoArticulo?: string;

  // Si no se envía, se usa el valor general del documento (aplicaItbis) —
  // así los documentos/formularios antiguos siguen funcionando igual.
  @IsOptional()
  @IsBoolean()
  aplicaItbis?: boolean;
}
