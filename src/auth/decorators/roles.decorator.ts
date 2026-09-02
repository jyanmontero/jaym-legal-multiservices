import { SetMetadata } from '@nestjs/common';
import { RolUsuario } from '../../common/enums/index.js';

export const ROLES_KEY = 'roles';

/**
 * Restringe un endpoint a uno o más roles, ej. @Roles(RolUsuario.SUPERADMINISTRADOR).
 * Requiere que JwtAuthGuard ya haya corrido antes (ver orden de guards en
 * cada controller o el guard global en main.ts).
 */
export const Roles = (...roles: RolUsuario[]) => SetMetadata(ROLES_KEY, roles);
