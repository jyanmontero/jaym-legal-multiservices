import { IsArray, IsDateString, IsIn, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { REDES, type RedSocial } from '../ficha-marca.js';

export class CrearPublicacionDto {
  @IsOptional() @IsString() @MaxLength(200) titulo?: string;
  @IsOptional() @IsString() tema?: string;
  @IsOptional() @IsArray() @IsIn(REDES, { each: true }) redes?: RedSocial[];
  @IsOptional() @IsObject() textos?: Partial<Record<RedSocial, string>>;
  @IsOptional() @IsString() enlaceDestino?: string;
}

export class GenerarPublicacionDto {
  @IsString() @MaxLength(500) tema: string;
  @IsOptional() @IsString() contexto?: string;
  @IsOptional() @IsString() enlace?: string;
  @IsOptional() @IsArray() @IsIn(REDES, { each: true }) redes?: RedSocial[];
}

export class DesdeBlogDto {
  @IsOptional() @IsArray() @IsIn(REDES, { each: true }) redes?: RedSocial[];
}

export class SugerirSemanaDto {
  @IsOptional() @IsInt() @Min(1) @Max(7) cantidad?: number;
  @IsOptional() @IsArray() @IsIn(REDES, { each: true }) redes?: RedSocial[];
}

export class ActualizarPublicacionDto {
  @IsOptional() @IsString() @MaxLength(200) titulo?: string;
  @IsOptional() @IsArray() @IsIn(REDES, { each: true }) redes?: RedSocial[];
  @IsOptional() @IsObject() textos?: Partial<Record<RedSocial, string>>;
  @IsOptional() @IsString() enlaceDestino?: string;
}

export class RegenerarPublicacionDto {
  @IsOptional() @IsString() @MaxLength(500) instrucciones?: string;
}

export class ProgramarPublicacionDto {
  @IsDateString() fechaProgramada: string;
}

export class MarcarManualDto {
  @IsIn(REDES) red: RedSocial;
  @IsOptional() @IsString() enlace?: string;
}
