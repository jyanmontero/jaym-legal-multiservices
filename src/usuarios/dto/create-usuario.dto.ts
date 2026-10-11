import { PasswordFuerte } from '../../common/validators/password-fuerte.js';
import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';
import { RolUsuario } from '../../common/enums/index.js';

export class CreateUsuarioDto {
  @IsString()
  nombreCompleto: string;

  @IsEmail()
  correo: string;

  @PasswordFuerte()
  password: string;

  @IsEnum(RolUsuario)
  rol: RolUsuario;
}

export class ResetearPasswordDto {
  @PasswordFuerte()
  nuevaPassword: string;
}
