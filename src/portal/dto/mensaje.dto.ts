import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CrearMensajeDto {
  @IsOptional()
  @IsUUID()
  expedienteId?: string;

  @IsString()
  contenido: string;
}
