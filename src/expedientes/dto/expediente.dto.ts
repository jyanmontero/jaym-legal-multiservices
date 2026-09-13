import { IsEnum, IsOptional, IsString, IsUUID, IsArray, IsDateString, ValidateIf } from 'class-validator';
import { MateriaJuridica, EstadoExpediente, NivelPrioridad, NivelRiesgo } from '../../common/enums/index.js';

export class CreateExpedienteDto {
  @IsUUID()
  clienteId: string;

  @IsOptional()
  @IsString()
  contraparte?: string;

  @IsOptional()
  @IsUUID()
  abogadoResponsableId?: string;

  @IsEnum(MateriaJuridica)
  materia: MateriaJuridica;

  @IsOptional()
  @IsString()
  tipoServicio?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  objetivo?: string;

  @IsOptional()
  @IsString()
  tribunalInstitucion?: string;

  @IsOptional()
  @IsDateString()
  fechaLimite?: string;

  @IsOptional()
  @IsEnum(NivelPrioridad)
  prioridad?: NivelPrioridad;

  @IsOptional()
  @IsEnum(NivelRiesgo)
  riesgo?: NivelRiesgo;

  @IsOptional()
  @IsArray()
  etiquetas?: string[];
}

// Todos los campos son opcionales en una actualización — solo se modifica
// lo que se envía, pero se compara contra el snapshot completo anterior.
export class UpdateExpedienteDto {
  @IsOptional()
  @IsString()
  contraparte?: string;

  // Acepta null explícito para desasignar (queda "sin responsable"), a
  // diferencia de omitir el campo, que no toca el valor actual.
  @IsOptional()
  @ValidateIf((o) => o.abogadoResponsableId !== null)
  @IsUUID()
  abogadoResponsableId?: string | null;

  @IsOptional()
  @IsString()
  tipoServicio?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  objetivo?: string;

  @IsOptional()
  @IsString()
  tribunalInstitucion?: string;

  @IsOptional()
  @IsDateString()
  proximaActuacion?: string;

  @IsOptional()
  @IsDateString()
  fechaLimite?: string;

  @IsOptional()
  @IsEnum(NivelPrioridad)
  prioridad?: NivelPrioridad;

  @IsOptional()
  @IsEnum(NivelRiesgo)
  riesgo?: NivelRiesgo;

  @IsOptional()
  @IsEnum(EstadoExpediente)
  estado?: EstadoExpediente;

  @IsOptional()
  @IsArray()
  etiquetas?: string[];

  // Motivo del cambio — no obligatorio, pero recomendado y se guarda en el
  // historial cuando se provee (sección 7).
  @IsOptional()
  @IsString()
  motivo?: string;
}
