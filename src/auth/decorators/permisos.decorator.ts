import { SetMetadata } from '@nestjs/common';
import { Permiso } from '../../common/enums/index.js';

export const PERMISOS_KEY = 'permisos';

/**
 * Restringe un endpoint a que el usuario tenga TODOS los permisos dados,
 * ej. @Permisos(Permiso.ELIMINAR_LOGICO). Requiere @UseGuards(PermisosGuard)
 * en el mismo endpoint (o en la clase), igual que @Roles() con RolesGuard.
 * Complementa a @Roles() -- no lo reemplaza en todos lados, se usa donde
 * la restricción real es "quien tenga tal permiso", no "quien tenga tal rol".
 */
export const Permisos = (...permisos: Permiso[]) => SetMetadata(PERMISOS_KEY, permisos);
