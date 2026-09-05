import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CrearSeguimientoDto {
  @IsString()
  @IsNotEmpty()
  texto: string;

  @IsOptional()
  @IsBoolean()
  hito?: boolean;
}
