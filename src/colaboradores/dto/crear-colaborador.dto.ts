import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { TipoColaborador } from '../../common/enums/index.js';

export class CrearColaboradorDto {
  @IsString()
  nombreCompleto: string;

  @IsEmail()
  correo: string;

  @IsEnum(TipoColaborador)
  tipo: TipoColaborador;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsString()
  notas?: string;
}

export class ActualizarColaboradorDto {
  @IsOptional()
  @IsString()
  nombreCompleto?: string;

  @IsOptional()
  @IsEnum(TipoColaborador)
  tipo?: TipoColaborador;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsString()
  notas?: string;
}
