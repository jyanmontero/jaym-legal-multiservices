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

// Edición de una plantilla ya creada -- mismo criterio de roles que crear
// y desactivar (ver RequisitosPlantillaController). No incluye "activo":
// para eso sigue existiendo el endpoint desactivar (que además preserva la
// intención -- una plantilla desactivada no debería "revivir" por accidente
// al editar otro campo).
export class UpdateRequisitoPlantillaDto {
  @IsOptional()
  @IsString()
  tipoServicio?: string;

  @IsOptional()
  @IsString()
  nombreRequisito?: string;

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
