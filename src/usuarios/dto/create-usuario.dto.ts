import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';
import { RolUsuario } from '../../common/enums/index.js';

export class CreateUsuarioDto {
  @IsString()
  nombreCompleto: string;

  @IsEmail()
  correo: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  password: string;

  @IsEnum(RolUsuario)
  rol: RolUsuario;
}

export class ResetearPasswordDto {
  @IsString()
  @MinLength(8, { message: 'La nueva contraseña debe tener al menos 8 caracteres' })
  nuevaPassword: string;
}
