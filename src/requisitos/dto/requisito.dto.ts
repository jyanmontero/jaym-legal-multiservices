import {
  IsEnum,
  IsOptional,
  IsString,
  IsBoolean,
  IsInt,
  IsDateString,
} from 'class-validator';
import { MateriaJuridica, EstadoRequisito } from '../../common/enums/index.js';

export class CreateRequisitoPlantillaDto {
  @IsEnum(MateriaJuridica)
  materia: MateriaJuridica;

  @IsOptional()
  @IsString()
  tipoServicio?: string;

  @IsString()
  nombreRequisito: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsBoolean()
  obligatorio?: boolean;

  @IsOptional()
  @IsInt()
  orden?: number;
}

export class CrearRequisitoManualDto {
  @IsString()
  nombreRequisito: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsBoolean()
  obligatorio?: boolean;

  @IsOptional()
  @IsDateString()
  fechaPrometida?: string;

  @IsOptional()
  @IsString()
  responsableId?: string;
}

export class ActualizarRequisitoDto {
  @IsOptional()
  @IsEnum(EstadoRequisito)
  estado?: EstadoRequisito;

  @IsOptional()
  @IsString()
  responsableId?: string;

  @IsOptional()
  @IsDateString()
  fechaPrometida?: string;

  @IsOptional()
  @IsString()
  documentoId?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;
}
