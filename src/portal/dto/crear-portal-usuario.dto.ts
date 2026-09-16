import { IsEmail, IsString } from 'class-validator';

export class CrearPortalUsuarioDto {
  @IsString()
  nombreCompleto: string;

  @IsEmail()
  correo: string;
}
