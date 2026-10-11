import { SetMetadata } from '@nestjs/common';

export const SESION_EXTERNA_KEY = 'sesionExterna';

/**
 * Marca un controlador o endpoint como destinado a sesiones EXTERNAS (Portal
 * del Cliente o Portal de Colaboradores). Todo lo demas es solo para el
 * personal interno: SoloStaffGuard rechaza ahi cualquier token que traiga
 * `tipo` ('portal' o 'colaborador'). Cada uno de esos endpoints sigue
 * verificando su propio tipo de sesion con PortalAuthGuard o
 * ColaboradorAuthGuard.
 */
export const SesionExterna = () => SetMetadata(SESION_EXTERNA_KEY, true);
