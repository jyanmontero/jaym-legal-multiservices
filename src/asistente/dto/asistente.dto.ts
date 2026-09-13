import { IsString, MinLength } from 'class-validator';

export class MensajeAsistenteDto {
  @IsString()
  @MinLength(1)
  texto: string;
}
