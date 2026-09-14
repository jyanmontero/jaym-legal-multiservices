import { MATRIZ_PERMISOS_POR_ROL, Permiso } from '../../common/enums/index.js';

/**
 * Único punto de verdad para "¿este usuario puede hacer X?". Primero mira
 * si el usuario tiene una excepción puntual guardada
 * (usuario.permisosPersonalizados) y, si no, cae al valor por defecto de
 * su rol (MATRIZ_PERMISOS_POR_ROL).
 */
export function tienePermiso(
  usuario: { rol: string; permisosPersonalizados?: Partial<Record<string, boolean>> } | undefined,
  permiso: Permiso,
): boolean {
  if (!usuario) return false;

  const excepcion = usuario.permisosPersonalizados?.[permiso];
  if (typeof excepcion === 'boolean') return excepcion;

  const permisosDelRol = MATRIZ_PERMISOS_POR_ROL[usuario.rol] ?? [];
  return permisosDelRol.includes(permiso);
}
