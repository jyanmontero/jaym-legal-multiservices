/**
 * Utilidades fiscales puras (sin base de datos) para el módulo de Compras /
 * gastos fiscales y el reporte de impuestos. Las columnas y los códigos de los
 * formatos 606 y 607 siguen los instructivos oficiales de la DGII
 * (dgii.gov.do > Formatos de Envío de Datos). Todo lo que se genera aquí es
 * material de apoyo para el contador: la presentación ante la DGII la hace
 * una persona desde la Oficina Virtual.
 */

// --- Catálogos oficiales (606) ------------------------------------------------

export const TIPOS_BIENES_SERVICIOS: Record<number, string> = {
  1: 'Gastos de personal',
  2: 'Gastos por trabajos, suministros y servicios',
  3: 'Arrendamientos',
  4: 'Gastos de activos fijos',
  5: 'Gastos de representación',
  6: 'Otras deducciones admitidas',
  7: 'Gastos financieros',
  8: 'Gastos extraordinarios',
  9: 'Compras y gastos que formarán parte del costo de venta',
  10: 'Adquisiciones de activos',
  11: 'Gastos de seguros',
};

export const TIPOS_RETENCION_ISR: Record<number, string> = {
  1: 'Alquileres',
  2: 'Honorarios por servicios',
  3: 'Otras rentas',
  4: 'Otras rentas (rentas presuntas)',
  5: 'Intereses pagados a personas jurídicas residentes',
  6: 'Intereses pagados a personas físicas residentes',
  7: 'Retención por proveedores del Estado',
  8: 'Juegos telefónicos',
  9: 'Retenciones subsector de ganadería de carne bovina',
};

export const FORMAS_PAGO_606: Record<number, string> = {
  1: 'Efectivo',
  2: 'Cheques/Transferencias/Depósito',
  3: 'Tarjeta crédito/débito',
  4: 'Compra a crédito',
  5: 'Permuta',
  6: 'Notas de crédito',
  7: 'Mixto',
};

// --- Identificación (RNC / cédula) -----------------------------------------------

export function soloDigitos(valor?: string | null): string {
  return (valor ?? '').replace(/\D/g, '');
}

/** 1 = RNC (9 dígitos), 2 = Cédula (11 dígitos); otro largo => undefined. */
export function tipoIdentificacionDe(valor?: string | null): 1 | 2 | undefined {
  const d = soloDigitos(valor);
  if (d.length === 9) return 1;
  if (d.length === 11) return 2;
  return undefined;
}

/** Dígito verificador del RNC dominicano (módulo 11, pesos 7-9-8-6-5-4-3-2). */
export function rncValido(valor?: string | null): boolean {
  const d = soloDigitos(valor);
  if (d.length !== 9) return false;
  const pesos = [7, 9, 8, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((acc, p, i) => acc + p * Number(d[i]), 0);
  const resto = suma % 11;
  const dv = resto === 0 ? 2 : resto === 1 ? 1 : 11 - resto;
  return dv === Number(d[8]);
}

/** Dígito verificador de la cédula dominicana (algoritmo de Luhn con pesos 1-2). */
export function cedulaValida(valor?: string | null): boolean {
  const d = soloDigitos(valor);
  if (d.length !== 11) return false;
  let suma = 0;
  for (let i = 0; i < 10; i++) {
    let prod = Number(d[i]) * (i % 2 === 0 ? 1 : 2);
    if (prod > 9) prod = Math.floor(prod / 10) + (prod % 10);
    suma += prod;
  }
  const dv = (10 - (suma % 10)) % 10;
  return dv === Number(d[10]);
}

// --- NCF / e-NCF --------------------------------------------------------------

/** Quita espacios y guiones y pasa a mayúsculas. */
export function normalizarNcf(valor?: string | null): string {
  return (valor ?? '').replace(/[\s-]/g, '').toUpperCase();
}

/**
 * Forma esperada: NCF tradicional "B" + 2 dígitos de tipo + 8 de secuencia (11
 * posiciones) o e-NCF "E" + 2 dígitos de tipo + 10 de secuencia (13 posiciones).
 * Solo revisa la forma, no que el comprobante exista ni esté vigente.
 */
export function ncfConFormatoValido(valor?: string | null): boolean {
  const n = normalizarNcf(valor);
  return /^B\d{10}$/.test(n) || /^E\d{12}$/.test(n);
}

// --- Montos ----------------------------------------------------------------------

export function redondear2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function dec(n: number | string | null | undefined): string {
  return redondear2(Number(n ?? 0)).toFixed(2);
}

/** Formato de miles con dos decimales (1,000,000.00) para pantallas y reportes. */
export function formatoMiles(n: number | string | null | undefined): string {
  return redondear2(Number(n ?? 0)).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export interface MontosCompra {
  montoServicios: number;
  montoBienes: number;
  itbisFacturado: number;
  isc?: number;
  otrosImpuestos?: number;
  propinaLegal?: number;
}

/** Total del comprobante = servicios + bienes + ITBIS + ISC + otros + propina. */
export function totalCompra(m: MontosCompra): number {
  return redondear2(
    m.montoServicios + m.montoBienes + m.itbisFacturado + (m.isc ?? 0) + (m.otrosImpuestos ?? 0) + (m.propinaLegal ?? 0),
  );
}

/** "AAAA-MM-DD" -> "AAAAMMDD" (formato de fecha de los formatos 606/607). */
export function fechaAAAAMMDD(fecha?: string | null): string {
  return (fecha ?? '').slice(0, 10).replace(/-/g, '');
}

export function periodoAAAAMM(anio: number, mes: number): string {
  return `${anio}${String(mes).padStart(2, '0')}`;
}

export function rangoDelMes(anio: number, mes: number): { desde: string; hasta: string } {
  const desde = `${anio}-${String(mes).padStart(2, '0')}-01`;
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const hasta = `${anio}-${String(mes).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`;
  return { desde, hasta };
}

// --- Filas de los formatos 606 y 607 ------------------------------------------

export interface CompraParaReporte {
  id: string;
  proveedorNombre: string;
  proveedorIdentificacion: string;
  tipoIdentificacion: number;
  tipoBienesServicios: number;
  ncf: string;
  ncfModificado?: string | null;
  fechaComprobante: string;
  fechaPago?: string | null;
  montoServicios: string;
  montoBienes: string;
  itbisFacturado: string;
  itbisRetenido: string;
  itbisAlCosto: string;
  tipoRetencionIsr?: number | null;
  retencionRenta: string;
  isc: string;
  otrosImpuestos: string;
  propinaLegal: string;
  formaPago: number;
}

/** Las 23 columnas del detalle del 606, en el orden del instructivo oficial. */
export const COLUMNAS_606 = [
  'RNC o Cédula',
  'Tipo Id',
  'Tipo Bienes y Servicios Comprados',
  'NCF',
  'NCF o Documento Modificado',
  'Fecha Comprobante',
  'Fecha Pago',
  'Monto Facturado en Servicios',
  'Monto Facturado en Bienes',
  'Total Monto Facturado',
  'ITBIS Facturado',
  'ITBIS Retenido',
  'ITBIS sujeto a Proporcionalidad (Art. 349)',
  'ITBIS llevado al Costo',
  'ITBIS por Adelantar',
  'ITBIS percibido en compras',
  'Tipo de Retención en ISR',
  'Monto Retención Renta',
  'ISR Percibido en compras',
  'Impuesto Selectivo al Consumo',
  'Otros Impuestos/Tasas',
  'Monto Propina Legal',
  'Forma de Pago',
] as const;

/** Detalle del 606 para una compra. Los campos "no habilitados" van vacíos. */
export function fila606(c: CompraParaReporte): string[] {
  const servicios = Number(c.montoServicios);
  const bienes = Number(c.montoBienes);
  const itbis = Number(c.itbisFacturado);
  const alCosto = Number(c.itbisAlCosto);
  const hayPago = Boolean(c.fechaPago);
  return [
    soloDigitos(c.proveedorIdentificacion),
    String(c.tipoIdentificacion),
    String(c.tipoBienesServicios),
    normalizarNcf(c.ncf),
    normalizarNcf(c.ncfModificado),
    fechaAAAAMMDD(c.fechaComprobante),
    fechaAAAAMMDD(c.fechaPago),
    dec(servicios),
    dec(bienes),
    dec(servicios + bienes),
    dec(itbis),
    // ITBIS retenido, retención de renta y su tipo solo aplican con fecha de pago.
    hayPago && Number(c.itbisRetenido) > 0 ? dec(c.itbisRetenido) : '',
    '',
    alCosto > 0 ? dec(alCosto) : '',
    dec(itbis - alCosto),
    '',
    hayPago && c.tipoRetencionIsr ? String(c.tipoRetencionIsr) : '',
    hayPago && Number(c.retencionRenta) > 0 ? dec(c.retencionRenta) : '',
    '',
    Number(c.isc) > 0 ? dec(c.isc) : '',
    Number(c.otrosImpuestos) > 0 ? dec(c.otrosImpuestos) : '',
    Number(c.propinaLegal) > 0 ? dec(c.propinaLegal) : '',
    String(c.formaPago),
  ];
}

export interface VentaParaReporte {
  facturaNumero: string;
  identificacion: string;
  /** 1 = RNC, 2 = Cédula, 3 = Pasaporte o ID tributaria */
  tipoIdentificacion: number;
  ncf: string;
  fechaComprobante: string;
  /** Valor de la venta sin impuestos (ya con descuento). */
  montoFacturado: number;
  itbisFacturado: number;
  efectivo: number;
  chequeTransferencia: number;
  tarjeta: number;
  credito: number;
  otras: number;
}

/** Las 23 columnas del detalle del 607, en el orden del instructivo oficial. */
export const COLUMNAS_607 = [
  'RNC/Cédula o Pasaporte',
  'Tipo Identificación',
  'Número Comprobante Fiscal',
  'Número Comprobante Fiscal Modificado',
  'Tipo de Ingreso',
  'Fecha Comprobante',
  'Fecha de Retención',
  'Monto Facturado',
  'ITBIS Facturado',
  'ITBIS Retenido por Terceros',
  'ITBIS Percibido',
  'Retención Renta por Terceros',
  'ISR Percibido',
  'Impuesto Selectivo al Consumo',
  'Otros Impuestos/Tasas',
  'Monto Propina Legal',
  'Efectivo',
  'Cheque/Transferencia/Depósito',
  'Tarjeta Débito/Crédito',
  'Venta a Crédito',
  'Bonos o Certificados de Regalo',
  'Permuta',
  'Otras Formas de Ventas',
] as const;

/** Detalle del 607 para una venta (tipo de ingreso 1: ingresos por operaciones). */
export function fila607(v: VentaParaReporte): string[] {
  const z = (n: number) => (n > 0 ? dec(n) : '');
  return [
    soloDigitos(v.identificacion) || v.identificacion,
    String(v.tipoIdentificacion),
    normalizarNcf(v.ncf),
    '',
    '1',
    fechaAAAAMMDD(v.fechaComprobante),
    '',
    dec(v.montoFacturado),
    dec(v.itbisFacturado),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    z(v.efectivo),
    z(v.chequeTransferencia),
    z(v.tarjeta),
    z(v.credito),
    '',
    '',
    z(v.otras),
  ];
}

/**
 * Archivo de texto: línea de encabezado (formato|RNC del contribuyente|período|
 * cantidad de registros) y una línea por comprobante, con los campos separados
 * por "|". Los instructivos públicos de la DGII no detallan el separador; este
 * es el que usa la herramienta de envío y debe revisarse con "Enviar Archivos
 * Pre-Validados" de la Oficina Virtual antes de presentarlo.
 */
export function construirTxt(formato: '606' | '607', rncContribuyente: string, periodo: string, filas: string[][]): string {
  const encabezado = [formato, soloDigitos(rncContribuyente), periodo, String(filas.length)].join('|');
  return [encabezado, ...filas.map((f) => f.join('|'))].join('\r\n') + '\r\n';
}

export function nombreArchivoDgii(formato: '606' | '607', rncContribuyente: string, periodo: string): string {
  return `DGII_F_${formato}_${soloDigitos(rncContribuyente)}_${periodo}.TXT`;
}

// --- Advertencias de revisión ---------------------------------------------------

/** Revisión de una compra antes de guardarla; devuelve textos en español. */
export function advertenciasDeCompra(c: {
  proveedorIdentificacion?: string | null;
  ncf?: string | null;
  fechaComprobante?: string | null;
  total?: number | null;
  montos?: MontosCompra;
}): string[] {
  const out: string[] = [];
  const id = soloDigitos(c.proveedorIdentificacion);
  if (!id) out.push('Falta el RNC o la cédula del proveedor.');
  else if (id.length === 9 && !rncValido(id)) out.push('El RNC del proveedor no pasa la verificación del dígito verificador; revísalo contra la factura.');
  else if (id.length === 11 && !cedulaValida(id)) out.push('La cédula del proveedor no pasa la verificación del dígito verificador; revísala contra la factura.');
  else if (id.length !== 9 && id.length !== 11) out.push('El RNC debe tener 9 dígitos y la cédula 11.');
  if (!c.ncf) out.push('Falta el NCF: sin comprobante fiscal el gasto no puede ir en el 606.');
  else if (!ncfConFormatoValido(c.ncf)) out.push('El NCF no tiene la forma esperada (B + 10 dígitos, o E + 12 dígitos para comprobante electrónico).');
  if (!c.fechaComprobante) out.push('Falta la fecha del comprobante.');
  if (c.montos && c.total != null) {
    const calculado = totalCompra(c.montos);
    if (Math.abs(calculado - c.total) > 0.05) {
      out.push(`Los montos no cuadran: suman ${formatoMiles(calculado)} y el total de la factura es ${formatoMiles(c.total)}.`);
    }
  }
  return out;
}
