import { IsObject } from 'class-validator';

export class ActualizarDatosSolicitudDto {
  @IsObject()
  datos: Record<string, string>;
}
