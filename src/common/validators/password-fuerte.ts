import { applyDecorators } from '@nestjs/common';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export const MENSAJE_PASSWORD_FUERTE =
  'La contraseña debe tener al menos 10 caracteres e incluir letras y números';

/** Contraseña nueva: minimo 10 caracteres, con al menos una letra y un numero. */
export function PasswordFuerte() {
  return applyDecorators(
    IsString(),
    MinLength(10, { message: MENSAJE_PASSWORD_FUERTE }),
    MaxLength(128, { message: 'La contraseña es demasiado larga' }),
    Matches(/^(?=.*\p{L})(?=.*\d).+$/u, { message: MENSAJE_PASSWORD_FUERTE }),
  );
}
