import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginPortalDto {
  @IsEmail()
  correo: string;

  @IsString()
  password: string;
}

export class SolicitarResetPortalDto {
  @IsEmail()
  correo: string;
}

export class RestablecerPasswordPortalDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(8)
  nuevaPassword: string;
}

export class CambiarPasswordPortalDto {
  @IsString()
  actual: string;

  @IsString()
  @MinLength(8)
  nueva: string;
}
