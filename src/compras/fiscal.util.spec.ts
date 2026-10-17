import { describe, it, expect } from 'vitest';
import {
  advertenciasDeCompra,
  cedulaValida,
  COLUMNAS_606,
  COLUMNAS_607,
  construirTxt,
  fila606,
  fila607,
  formatoMiles,
  ncfConFormatoValido,
  nombreArchivoDgii,
  normalizarNcf,
  rangoDelMes,
  rncValido,
  tipoIdentificacionDe,
  totalCompra,
  type CompraParaReporte,
  type VentaParaReporte,
} from './fiscal.util.js';

const compraBase: CompraParaReporte = {
  id: 'c1',
  proveedorNombre: 'Proveedor Prueba SRL',
  proveedorIdentificacion: '133540772',
  tipoIdentificacion: 1,
  tipoBienesServicios: 2,
  ncf: 'b01-00000123',
  ncfModificado: null,
  fechaComprobante: '2026-09-15',
  fechaPago: '2026-09-20',
  montoServicios: '1000.00',
  montoBienes: '500.00',
  itbisFacturado: '270.00',
  itbisRetenido: '0.00',
  itbisAlCosto: '70.00',
  tipoRetencionIsr: null,
  retencionRenta: '0.00',
  isc: '0.00',
  otrosImpuestos: '0.00',
  propinaLegal: '0.00',
  formaPago: 2,
};

describe('identificación', () => {
  it('valida el dígito verificador del RNC de JAYM Legal', () => {
    expect(rncValido('133540772')).toBe(true);
    expect(rncValido('133-54077-2')).toBe(true);
    expect(rncValido('133540773')).toBe(false);
    expect(rncValido('12345')).toBe(false);
  });

  it('valida cédulas con el dígito verificador', () => {
    expect(cedulaValida('00100000009')).toBe(true);
    expect(cedulaValida('001-0000000-9')).toBe(true);
    expect(cedulaValida('00100000001')).toBe(false);
  });

  it('distingue RNC (9) de cédula (11)', () => {
    expect(tipoIdentificacionDe('133-54077-2')).toBe(1);
    expect(tipoIdentificacionDe('001-0000000-9')).toBe(2);
    expect(tipoIdentificacionDe('1234')).toBeUndefined();
  });
});

describe('NCF', () => {
  it('normaliza y valida la forma', () => {
    expect(normalizarNcf(' b01-00000123 ')).toBe('B0100000123');
    expect(ncfConFormatoValido('B0100000123')).toBe(true);
    expect(ncfConFormatoValido('E310000000123')).toBe(true);
    expect(ncfConFormatoValido('B01123')).toBe(false);
    expect(ncfConFormatoValido('')).toBe(false);
  });
});

describe('montos y fechas', () => {
  it('suma el total del comprobante', () => {
    expect(totalCompra({ montoServicios: 1000, montoBienes: 500, itbisFacturado: 270 })).toBe(1770);
    expect(totalCompra({ montoServicios: 100, montoBienes: 0, itbisFacturado: 18, propinaLegal: 10 })).toBe(128);
  });

  it('formatea con separador de miles y dos decimales', () => {
    expect(formatoMiles(1000000)).toBe('1,000,000.00');
    expect(formatoMiles('20279.6')).toBe('20,279.60');
  });

  it('calcula el rango del mes, incluso febrero bisiesto', () => {
    expect(rangoDelMes(2026, 9)).toEqual({ desde: '2026-09-01', hasta: '2026-09-30' });
    expect(rangoDelMes(2028, 2)).toEqual({ desde: '2028-02-01', hasta: '2028-02-29' });
    expect(rangoDelMes(2026, 12)).toEqual({ desde: '2026-12-01', hasta: '2026-12-31' });
  });
});

describe('formato 606', () => {
  it('tiene las 23 columnas oficiales y la fila las llena en orden', () => {
    expect(COLUMNAS_606).toHaveLength(23);
    const f = fila606(compraBase);
    expect(f).toHaveLength(23);
    expect(f[0]).toBe('133540772');
    expect(f[1]).toBe('1');
    expect(f[2]).toBe('2');
    expect(f[3]).toBe('B0100000123');
    expect(f[5]).toBe('20260915');
    expect(f[6]).toBe('20260920');
    expect(f[7]).toBe('1000.00');
    expect(f[8]).toBe('500.00');
    expect(f[9]).toBe('1500.00');
    expect(f[10]).toBe('270.00');
    expect(f[13]).toBe('70.00'); // ITBIS al costo
    expect(f[14]).toBe('200.00'); // ITBIS por adelantar = 270 - 70
    expect(f[22]).toBe('2');
  });

  it('sin fecha de pago no manda retenciones', () => {
    const f = fila606({ ...compraBase, fechaPago: null, itbisRetenido: '50.00', tipoRetencionIsr: 2, retencionRenta: '100.00' });
    expect(f[6]).toBe('');
    expect(f[11]).toBe('');
    expect(f[16]).toBe('');
    expect(f[17]).toBe('');
  });

  it('con fecha de pago sí manda las retenciones', () => {
    const f = fila606({ ...compraBase, itbisRetenido: '50.00', tipoRetencionIsr: 2, retencionRenta: '100.00' });
    expect(f[11]).toBe('50.00');
    expect(f[16]).toBe('2');
    expect(f[17]).toBe('100.00');
  });
});

describe('formato 607', () => {
  const venta: VentaParaReporte = {
    facturaNumero: 'FAC-2026-0001',
    identificacion: '001-0000000-9',
    tipoIdentificacion: 2,
    ncf: 'E310000000001',
    fechaComprobante: '2026-09-02',
    montoFacturado: 10000,
    itbisFacturado: 1800,
    efectivo: 0,
    chequeTransferencia: 5000,
    tarjeta: 0,
    credito: 6800,
    otras: 0,
  };

  it('tiene las 23 columnas oficiales y reparte las formas de pago', () => {
    expect(COLUMNAS_607).toHaveLength(23);
    const f = fila607(venta);
    expect(f).toHaveLength(23);
    expect(f[0]).toBe('00100000009');
    expect(f[1]).toBe('2');
    expect(f[2]).toBe('E310000000001');
    expect(f[4]).toBe('1');
    expect(f[5]).toBe('20260902');
    expect(f[7]).toBe('10000.00');
    expect(f[8]).toBe('1800.00');
    expect(f[17]).toBe('5000.00');
    expect(f[19]).toBe('6800.00');
    const pagos = [16, 17, 18, 19, 20, 21, 22].reduce((a, i) => a + Number(f[i] || 0), 0);
    expect(pagos).toBeCloseTo(11800, 2); // suma de formas de pago = total con impuestos
  });
});

describe('archivo de texto', () => {
  it('arma encabezado con cantidad de registros y una línea por comprobante', () => {
    const txt = construirTxt('606', '133-54077-2', '202609', [fila606(compraBase)]);
    const lineas = txt.trim().split('\r\n');
    expect(lineas[0]).toBe('606|133540772|202609|1');
    expect(lineas).toHaveLength(2);
    expect(lineas[1].split('|')).toHaveLength(23);
    expect(nombreArchivoDgii('606', '133540772', '202609')).toBe('DGII_F_606_133540772_202609.TXT');
  });
});

describe('advertencias de revisión', () => {
  it('avisa de RNC inválido, NCF faltante y montos que no cuadran', () => {
    const a = advertenciasDeCompra({
      proveedorIdentificacion: '133540773',
      ncf: '',
      fechaComprobante: '2026-09-15',
      total: 2000,
      montos: { montoServicios: 1000, montoBienes: 0, itbisFacturado: 180 },
    });
    expect(a.some((t) => t.includes('dígito verificador'))).toBe(true);
    expect(a.some((t) => t.includes('Falta el NCF'))).toBe(true);
    expect(a.some((t) => t.includes('no cuadran'))).toBe(true);
  });

  it('una factura correcta no genera avisos', () => {
    const a = advertenciasDeCompra({
      proveedorIdentificacion: '133540772',
      ncf: 'B0100000123',
      fechaComprobante: '2026-09-15',
      total: 1180,
      montos: { montoServicios: 1000, montoBienes: 0, itbisFacturado: 180 },
    });
    expect(a).toEqual([]);
  });
});
