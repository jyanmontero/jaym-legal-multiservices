import { TASA_ITBIS } from '../common/enums/index.js';

/**
 * Línea de una cotización o factura. Se guarda como JSON dentro de la fila
 * (columna `items`) en vez de una tabla aparte — para el volumen de un
 * despacho legal (pocas líneas por documento) simplifica el modelo sin
 * costo real; si el volumen crece se puede migrar a una tabla propia sin
 * romper la API pública (la forma del array se mantendría igual).
 *
 * `aplicaItbis` es por línea (permite mezclar, en un mismo documento,
 * servicios gravados con ITBIS y servicios exentos). Si una línea no trae
 * el campo (documentos creados antes de este cambio), se usa el valor
 * general del documento como respaldo — ver calcularTotales.
 */
export interface ItemFacturable {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  codigoArticulo?: string;
  aplicaItbis?: boolean;
}

/**
 * El descuento se aplica como un monto fijo en RD$ sobre el subtotal,
 * antes de calcular el ITBIS (el ITBIS dominicano se calcula sobre la base
 * imponible ya descontada). Un descuento mayor al subtotal se recorta a 0
 * en vez de producir una base imponible negativa. El descuento se prorratea
 * proporcionalmente entre las líneas para poder calcular el ITBIS línea por
 * línea de forma consistente con el total general.
 */
export function calcularTotales(
  items: ItemFacturable[],
  aplicaItbisGeneral: boolean,
  descuento = 0,
) {
  const subtotal = items.reduce((acc, i) => acc + i.cantidad * i.precioUnitario, 0);
  const descuentoAplicado = Math.min(Math.max(descuento, 0), subtotal);
  const factorDescuento = subtotal > 0 ? (subtotal - descuentoAplicado) / subtotal : 1;

  let itbis = 0;
  let algunaLineaConItbis = false;
  for (const item of items) {
    const aplicaEstaLinea = item.aplicaItbis !== undefined ? item.aplicaItbis : aplicaItbisGeneral;
    if (aplicaEstaLinea) {
      algunaLineaConItbis = true;
      const baseLinea = item.cantidad * item.precioUnitario * factorDescuento;
      itbis += baseLinea * TASA_ITBIS;
    }
  }

  const baseImponible = subtotal - descuentoAplicado;
  const total = baseImponible + itbis;
  return {
    subtotal: subtotal.toFixed(2),
    descuento: descuentoAplicado.toFixed(2),
    itbis: itbis.toFixed(2),
    total: total.toFixed(2),
    // Se guarda a nivel de documento solo para reportes/filtros que ya
    // dependían de este campo — el cálculo real siempre es por línea.
    aplicaItbis: algunaLineaConItbis,
  };
}
