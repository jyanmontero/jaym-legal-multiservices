import { SetMetadata } from '@nestjs/common';

export const PERMITIR_PASSWORD_PENDIENTE_KEY = 'permitirPasswordPendiente';

/**
 * Marca una ruta del Portal de Colaboradores como accesible aunque la cuenta
 * tenga debeCambiarPassword=true (ej. el propio endpoint para cambiarla).
 * Sin esto, ColaboradorAuthGuard bloquea cualquier otra acción hasta que el
 * colaborador establezca una contraseña propia -- ver razonamiento en
 * ColaboradorAuthGuard. Resolución del 26/09/2026: antes, este flag se
 * devolvía en el login pero nada lo hacía cumplir en el resto de la API.
 */
export const PermitirPasswordPendiente = () => SetMetadata(PERMITIR_PASSWORD_PENDIENTE_KEY, true);
