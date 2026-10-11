import { describe, it, expect } from 'vitest';
import {
  normalizarTelefonoRD,
  construirAsuntoYMensaje,
  construirMensajeWhatsapp,
  parsearDestinatarios,
  textoAHtml,
  balancePendiente,
  type DatosCobro,
} from './cobros.util.js';

const base: DatosCobro = {
  tipo: 'factura',
  nombreCliente: 'Juan Pérez',
  numero: 'FAC-2026-0007',
  concepto: 'Trámite de cédula',
  total: '10000',
  montoPagado: '4000',
  fechaVencimiento: '2026-09-30',
  hoyIso: '2026-10-11',
};

describe('normalizarTelefonoRD', () => {
  it('acepta formatos comunes', () => {
    expect(normalizarTelefonoRD('849-464-4313')).toBe('18494644313');
    expect(normalizarTelefonoRD('(809) 555 1234')).toBe('18095551234');
    expect(normalizarTelefonoRD('+1 829 555 1234')).toBe('18295551234');
    expect(normalizarTelefonoRD('18494644313')).toBe('18494644313');
  });
  it('rechaza lo que no es dominicano o está incompleto', () => {
    expect(normalizarTelefonoRD('555-1234')).toBeNull();
    expect(normalizarTelefonoRD('305 555 1234')).toBeNull();
    expect(normalizarTelefonoRD(null)).toBeNull();
    expect(normalizarTelefonoRD('')).toBeNull();
  });
});

describe('mensajes de cobro', () => {
  it('la factura muestra total, pagado, balance y datos de pago', () => {
    const { asunto, mensaje } = construirAsuntoYMensaje(base);
    expect(asunto).toContain('FAC-2026-0007');
    expect(mensaje).toContain('RD$ 10,000.00');
    expect(mensaje).toContain('Pagado: RD$ 4,000.00');
    expect(mensaje).toContain('Balance pendiente: RD$ 6,000.00');
    expect(mensaje).toContain('Banreservas');
  });
  it('una factura pagada no pide pago', () => {
    const { mensaje } = construirAsuntoYMensaje({ ...base, montoPagado: '10000' });
    expect(mensaje).not.toContain('Balance pendiente');
    expect(mensaje).not.toContain('realizar el pago');
  });
  it('el recordatorio menciona el vencimiento y pide el comprobante', () => {
    const { asunto, mensaje } = construirAsuntoYMensaje({ ...base, tipo: 'recordatorio' });
    expect(asunto).toContain('Recordatorio');
    expect(mensaje).toContain('vencido desde el 30/09/2026');
    expect(mensaje).toContain('comprobante');
  });
  it('la cotización incluye la validez y la estructura de pagos', () => {
    const { mensaje } = construirAsuntoYMensaje({ ...base, tipo: 'cotizacion', validaHasta: '2026-11-01' });
    expect(mensaje).toContain('Válida hasta el 01/11/2026');
    expect(mensaje).toContain('50% como anticipo');
  });
  it('el mensaje de WhatsApp es corto y nunca incluye notas internas', () => {
    const m = construirMensajeWhatsapp({ ...base, tipo: 'recordatorio' });
    expect(m.length).toBeLessThan(600);
    expect(m).toContain('RD$ 6,000.00');
  });
  it('balancePendiente redondea a centavos', () => {
    expect(balancePendiente({ total: '100.10', montoPagado: '0.05' })).toBe(100.05);
  });
});

describe('correo', () => {
  it('valida destinatarios', () => {
    expect(parsearDestinatarios('a@b.com, c@d.do')).toEqual(['a@b.com', 'c@d.do']);
    expect(parsearDestinatarios('malo')).toBeNull();
    expect(parsearDestinatarios('')).toBeNull();
    expect(parsearDestinatarios('a@b.com,b@c.com,c@d.com,d@e.com,e@f.com,f@g.com')).toBeNull();
  });
  it('textoAHtml escapa HTML y conserva saltos', () => {
    const h = textoAHtml('Hola <script>x</script>\nlínea 2\n\nOtro');
    expect(h).not.toContain('<script>');
    expect(h).toContain('&lt;script&gt;');
    expect(h).toContain('<br>');
    expect(h.match(/<p /g)?.length).toBe(2);
  });
});
