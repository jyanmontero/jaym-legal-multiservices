import { formatearRD } from '../common/formato-moneda.js';
import {
  CUENTAS_BANCARIAS,
  ESTRUCTURA_PAGOS,
  MARCA_CORPORATIVA,
} from '../common/constants/marca-corporativa.js';

/**
 * Teléfono dominicano -> solo dígitos con prefijo 1 (formato que pide
 * wa.me). Acepta "849-464-4313", "(849) 464 4313", "+1 849 464 4313" o
 * "18494644313". Devuelve null si no parece un número dominicano válido
 * (así la pantalla avisa en vez de abrir un chat a un número equivocado).
 */
export function normalizarTelefonoRD(telefono: string | null | undefined): string | null {
  const digitos = String(telefono ?? '').replace(/\D/g, '');
  if (digitos.length === 10 && /^(809|829|849)/.test(digitos)) return `1${digitos}`;
  if (digitos.length === 11 && /^1(809|829|849)/.test(digitos)) return digitos;
  return null;
}

export function formatearFecha(iso: string | null | undefined): string {
  if (!iso) return '';
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  return a && m && d ? `${d}/${m}/${a}` : '';
}

function datosDePago(): string {
  const lineas = CUENTAS_BANCARIAS.flatMap((b) =>
    b.cuentas.map((c) => `- ${b.banco}, ${c.tipo} No. ${c.numero}`),
  );
  return `A nombre de ${MARCA_CORPORATIVA.razonSocial} (RNC ${MARCA_CORPORATIVA.rnc}):\n${lineas.join('\n')}`;
}

const DESPEDIDA =
  `Quedamos atentos a cualquier consulta al ${MARCA_CORPORATIVA.telefono} o a ${MARCA_CORPORATIVA.correos[1]}.\n\n` +
  `Atentamente,\n${MARCA_CORPORATIVA.razonSocial}\n${MARCA_CORPORATIVA.eslogan}`;

export interface DatosCobro {
  tipo: 'cotizacion' | 'factura' | 'recordatorio';
  nombreCliente: string;
  numero: string;
  concepto: string;
  total: string | number;
  montoPagado?: string | number;
  fechaVencimiento?: string | null;
  validaHasta?: string | null;
  enlacePago?: string | null;
  hoyIso: string;
}

export function balancePendiente(d: Pick<DatosCobro, 'total' | 'montoPagado'>): number {
  const b = Number(d.total) - Number(d.montoPagado ?? 0);
  return Math.round(b * 100) / 100;
}

/** Texto plano (editable por la persona antes de enviar) del correo. */
export function construirAsuntoYMensaje(d: DatosCobro): { asunto: string; mensaje: string } {
  const saludo = `Estimado/a ${d.nombreCliente}:\n\nReciba un cordial saludo de ${MARCA_CORPORATIVA.razonSocial}.`;
  const balance = balancePendiente(d);
  const vencida = Boolean(d.fechaVencimiento && d.fechaVencimiento < d.hoyIso && balance > 0);

  if (d.tipo === 'cotizacion') {
    const partes = [
      saludo,
      `Adjuntamos la cotización ${d.numero} por concepto de: ${d.concepto}.`,
      `Total: ${formatearRD(d.total)}.` + (d.validaHasta ? ` Válida hasta el ${formatearFecha(d.validaHasta)}.` : ''),
      `Estructura de pagos: ${ESTRUCTURA_PAGOS}`,
      DESPEDIDA,
    ];
    return { asunto: `Cotización ${d.numero} - ${MARCA_CORPORATIVA.razonSocial}`, mensaje: partes.join('\n\n') };
  }

  const pago = [
    'Puede realizar el pago por transferencia o depósito a:',
    datosDePago(),
    d.enlacePago ? `También puede pagar con tarjeta en este enlace: ${d.enlacePago}` : '',
    'Una vez realizado, le agradecemos enviarnos el comprobante.',
  ]
    .filter(Boolean)
    .join('\n');

  if (d.tipo === 'factura') {
    const partes = [
      saludo,
      `Adjuntamos la factura ${d.numero} por concepto de: ${d.concepto}.`,
      `Total: ${formatearRD(d.total)}.` +
        (Number(d.montoPagado ?? 0) > 0 ? ` Pagado: ${formatearRD(d.montoPagado)}.` : '') +
        (balance > 0 ? ` Balance pendiente: ${formatearRD(balance)}.` : '') +
        (d.fechaVencimiento ? ` Fecha de vencimiento: ${formatearFecha(d.fechaVencimiento)}.` : ''),
      balance > 0 ? pago : '',
      DESPEDIDA,
    ].filter(Boolean);
    return { asunto: `Factura ${d.numero} - ${MARCA_CORPORATIVA.razonSocial}`, mensaje: partes.join('\n\n') };
  }

  const partes = [
    saludo,
    `Le escribimos para recordarle que la factura ${d.numero}, por concepto de ${d.concepto}, ` +
      `presenta un balance pendiente de ${formatearRD(balance)}` +
      (vencida ? `, vencido desde el ${formatearFecha(d.fechaVencimiento)}` : '') +
      '. Adjuntamos una copia para su referencia.',
    pago,
    'Si ya realizó el pago, le agradecemos enviarnos el comprobante y disculpe la molestia.',
    DESPEDIDA,
  ];
  return { asunto: `Recordatorio de pago - Factura ${d.numero}`, mensaje: partes.join('\n\n') };
}

/** Versión corta para WhatsApp (el PDF se adjunta a mano o va por correo). */
export function construirMensajeWhatsapp(d: DatosCobro): string {
  const balance = balancePendiente(d);
  const cuenta = CUENTAS_BANCARIAS[0];
  const pagoCorto = `Datos para el pago: ${cuenta.banco}, ${cuenta.cuentas[0].tipo} No. ${cuenta.cuentas[0].numero}, a nombre de ${MARCA_CORPORATIVA.razonSocial}.`;
  const saludo = `Estimado/a ${d.nombreCliente}, le saludamos de ${MARCA_CORPORATIVA.razonSocial}.`;
  if (d.tipo === 'cotizacion') {
    return `${saludo} Le compartimos la cotización ${d.numero} por ${d.concepto}, por un total de ${formatearRD(d.total)}.` +
      (d.validaHasta ? ` Válida hasta el ${formatearFecha(d.validaHasta)}.` : '') +
      ' Le enviamos el documento en PDF. Quedamos atentos a sus consultas.';
  }
  if (d.tipo === 'factura') {
    return `${saludo} Le compartimos la factura ${d.numero} por ${d.concepto}. Total: ${formatearRD(d.total)}.` +
      (balance > 0 ? ` Balance pendiente: ${formatearRD(balance)}. ${pagoCorto}` : '') +
      ' Le enviamos el documento en PDF. Gracias por su confianza.';
  }
  const vencida = Boolean(d.fechaVencimiento && d.fechaVencimiento < d.hoyIso);
  return `${saludo} Le recordamos que la factura ${d.numero} (${d.concepto}) tiene un balance pendiente de ${formatearRD(balance)}` +
    (vencida ? `, vencido desde el ${formatearFecha(d.fechaVencimiento)}` : '') +
    `. ${pagoCorto} Si ya realizó el pago, envíenos el comprobante y disculpe la molestia.`;
}

function escaparHtml(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Convierte el texto plano editado en el cuerpo HTML del correo (sin permitir HTML inyectado). */
export function textoAHtml(texto: string): string {
  const parrafos = texto
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;line-height:1.55">${escaparHtml(p.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('');
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1c2a3a;max-width:620px">${parrafos}</div>`;
}

const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;

/** Valida y limpia una lista de correos separados por coma/punto y coma. Devuelve null si alguno es inválido. */
export function parsearDestinatarios(texto: string | null | undefined): string[] | null {
  const lista = String(texto ?? '')
    .split(/[;,]/)
    .map((x) => x.trim())
    .filter(Boolean);
  if (lista.length === 0 || lista.length > 5) return null;
  return lista.every((c) => EMAIL_RE.test(c)) ? lista : null;
}
