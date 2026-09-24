import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginColaboradorDto {
  @IsEmail()
  correo: string;

  @IsString()
  password: string;
}

export class SolicitarResetColaboradorDto {
  @IsEmail()
  correo: string;
}

export class RestablecerPasswordColaboradorDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(8)
  nuevaPassword: string;
}

export class CambiarPasswordColaboradorDto {
  @IsString()
  actual: string;

  @IsString()
  @MinLength(8)
  nueva: string;
}
