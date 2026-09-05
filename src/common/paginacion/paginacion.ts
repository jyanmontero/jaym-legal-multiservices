/**
 * Paginación opcional para los listados que hoy devuelven la tabla completa
 * en una sola respuesta (GET /expedientes, /clientes, /facturas,
 * /cotizaciones, /documentos, /usuarios -- hallazgo "Resistencia y
 * escalabilidad" de la auditoría). Deliberadamente "opt-in": si el llamador
 * no manda `pagina`/`porPagina`, el endpoint se comporta exactamente igual
 * que antes (arreglo completo, sin paginar) -- así el frontend actual, que
 * no manda esos parámetros, no se rompe. Cuando sí se mandan, la respuesta
 * cambia de forma (de `T[]` a `ResultadoPaginado<T>`); eso es intencional y
 * es responsabilidad de quien pida paginación explícita saber leer esa forma.
 */

export const POR_PAGINA_POR_DEFECTO = 20;
export const POR_PAGINA_MAXIMA = 200;

export interface ResultadoPaginado<T> {
  datos: T[];
  total: number;
  pagina: number;
  porPagina: number;
}

export interface ParametrosPaginacion {
  pagina: number;
  porPagina: number;
}

/**
 * Devuelve null si el llamador no pidió paginación (ni `pagina` ni
 * `porPagina` en el query string) -- en ese caso el servicio debe seguir
 * devolviendo todo, sin límite, como hacía antes de este cambio.
 */
export function parsearPaginacion(pagina?: string, porPagina?: string): ParametrosPaginacion | null {
  if (pagina === undefined && porPagina === undefined) return null;

  const paginaNum = Math.max(1, parseInt(pagina ?? '1', 10) || 1);
  const porPaginaNum = Math.min(
    POR_PAGINA_MAXIMA,
    Math.max(1, parseInt(porPagina ?? String(POR_PAGINA_POR_DEFECTO), 10) || POR_PAGINA_POR_DEFECTO),
  );

  return { pagina: paginaNum, porPagina: porPaginaNum };
}
