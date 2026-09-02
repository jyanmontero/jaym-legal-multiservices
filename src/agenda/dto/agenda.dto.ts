import {
  IsEnum,
  IsOptional,
  IsString,
  IsDateString,
  IsArray,
  IsInt,
} from 'class-validator';
import {
  TipoEventoAgenda,
  EstadoEventoAgenda,
  NivelPrioridad,
} from '../../common/enums/index.js';

export class CrearEventoAgendaDto {
  @IsEnum(TipoEventoAgenda)
  tipo: TipoEventoAgenda;

  @IsString()
  titulo: string;

  @IsOptional()
  @IsString()
  expedienteId?: string;

  @IsOptional()
  @IsString()
  clienteId?: string;

  @IsDateString()
  fechaHoraInicio: string;

  @IsOptional()
  @IsDateString()
  fechaHoraFin?: string;

  @IsOptional()
  @IsString()
  responsableId?: string; // si no se envía, se asigna a quien lo crea

  @IsOptional()
  @IsArray()
  colaboradores?: string[];

  @IsOptional()
  @IsEnum(NivelPrioridad)
  prioridad?: NivelPrioridad;

  @IsOptional()
  @IsInt()
  recordatorioMinutosAntes?: number;

  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class ActualizarEventoAgendaDto {
  @IsOptional()
  @IsString()
  titulo?: string;

  @IsOptional()
  @IsDateString()
  fechaHoraInicio?: string;

  @IsOptional()
  @IsDateString()
  fechaHoraFin?: string;

  @IsOptional()
  @IsString()
  responsableId?: string;

  @IsOptional()
  @IsArray()
  colaboradores?: string[];

  @IsOptional()
  @IsEnum(NivelPrioridad)
  prioridad?: NivelPrioridad;

  @IsOptional()
  @IsEnum(EstadoEventoAgenda)
  estado?: EstadoEventoAgenda;

  @IsOptional()
  @IsInt()
  recordatorioMinutosAntes?: number;

  @IsOptional()
  @IsString()
  observaciones?: string;
}
