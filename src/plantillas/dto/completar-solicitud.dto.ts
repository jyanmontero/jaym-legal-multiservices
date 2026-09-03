import { IsObject } from 'class-validator';

export class CompletarSolicitudDto {
  @IsObject()
  datos: Record<string, string>;
}
