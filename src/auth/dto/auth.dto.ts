import { IsEmail, IsString, MinLength, IsOptional, Length } from 'class-validator';

export class LoginDto {
  @IsEmail()
  correo: string;

  @IsString()
  @MinLength(1)
  password: string;

  // Requerido solo si el usuario tiene 2FA activo — ver AuthService.
  @IsOptional()
  @IsString()
  @Length(6, 6)
  codigoDosFactor?: string;
}

export class VerificarDosFactorDto {
  @IsString()
  @Length(6, 6)
  codigo: string;
}

export class CambiarPasswordDto {
  @IsString()
  @MinLength(1)
  actual: string;

  @IsString()
  @MinLength(8, { message: 'La nueva contraseña debe tener al menos 8 caracteres' })
  nueva: string;
}

export class OlvidePasswordDto {
  @IsEmail()
  correo: string;
}

export class RestablecerPasswordDto {
  @IsString()
  @MinLength(1)
  token: string;

  @IsString()
  @MinLength(8, { message: 'La nueva contraseña debe tener al menos 8 caracteres' })
  nuevaPassword: string;
}
