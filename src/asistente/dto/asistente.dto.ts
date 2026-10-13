import { IsOptional, IsString, MaxLength } from 'class-validator';

export class MensajeAsistenteDto {
  // Opcional: con una foto adjunta basta (el asistente registra al cliente).
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  texto?: string;

  // JSON con los últimos mensajes de la conversación (multipart no admite arreglos).
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  historial?: string;
}

export class ConfirmarAccionAsistenteDto {
  @IsString()
  @MaxLength(20000)
  token: string;
}
