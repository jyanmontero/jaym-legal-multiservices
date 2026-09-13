import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marca un endpoint como accesible sin JWT (ej. /auth/login).
 * El guard global JwtAuthGuard revisa esta metadata antes de exigir token.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
