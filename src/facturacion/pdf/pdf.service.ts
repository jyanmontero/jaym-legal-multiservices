import { Injectable } from '@nestjs/common';
import pdfMake from 'pdfmake';
import { Cliente } from '../../clientes/cliente.entity.js';
import { Cotizacion } from '../cotizacion.entity.js';
import { Factura } from '../factura.entity.js';
import { TipoCliente } from '../../common/enums/index.js';
import {
  MARCA_CORPORATIVA,
  CLAUSULA_GESTION,
  ESTRUCTURA_PAGOS,
  CUENTAS_BANCARIAS,
} from '../../common/constants/marca-corporativa.js';
import type { ItemFacturable } from '../item-facturable.js';
import { LOGO_JAYM_BASE64 } from './logo-base64.js';

const ANCHO_CONTENIDO = 527; // Letter (612pt) - 2 × 42.5pt de margen = hoja timbrada a 15mm
const MARGEN = 42.5; // 15mm en puntos

// pdfmake (API de servidor) trabaja con los 14 fonts estándar de PDF sin
// necesidad de archivos .ttf embebidos — Helvetica es el equivalente
// directo de Arial pedido en la especificación de la hoja timbrada.
pdfMake.setFonts({
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
});
// El documento no referencia imágenes ni URLs externas, solo los 4
// nombres de fuente estándar declarados arriba. pdfmake valida CUALQUIER
// ruta de fuente (incluidos los nombres estándar) contra la política de
// acceso local, así que debe permitir explícitamente esos 4 nombres —
// denegar todo (como con las URLs) rompería el renderizado por completo.
const FUENTES_PERMITIDAS = new Set(['Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique', 'Helvetica-BoldOblique']);
pdfMake.setUrlAccessPolicy(() => false);
pdfMake.setLocalAccessPolicy((ruta: string) => FUENTES_PERMITIDAS.has(ruta));

function formatoRD(valor: number | string): string {
  const n = typeof valor === 'string' ? Number(valor) : valor;
  return `RD$ ${n.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function nombreCliente(cliente: Cliente): string {
  return cliente.tipo === TipoCliente.JURIDICO
    ? (cliente.razonSocial ?? cliente.nombreComercial ?? '')
    : `${cliente.nombres ?? ''} ${cliente.apellidos ?? ''}`.trim();
}

function identificacionCliente(cliente: Cliente): { etiqueta: string; valor: string } {
  if (cliente.tipo === TipoCliente.JURIDICO && cliente.rnc) {
    return { etiqueta: 'RNC', valor: cliente.rnc };
  }
  if (cliente.cedula) return { etiqueta: 'Cédula', valor: cliente.cedula };
  if (cliente.pasaporte) return { etiqueta: 'Pasaporte', valor: cliente.pasaporte };
  if (cliente.rnc) return { etiqueta: 'RNC', valor: cliente.rnc };
  return { etiqueta: 'Identificación', valor: '—' };
}

interface DatosDocumento {
  tipoDocumento: 'COTIZACIÓN' | 'FACTURA';
  numero: string;
  ncf?: string;
  fechaEmision: string;
  fechaVencimiento?: string;
  estado: string;
  cliente: Cliente;
  expedienteCodigo?: string;
  concepto: string;
  items: ItemFacturable[];
  aplicaItbis: boolean;
  subtotal: string;
  descuento: string;
  itbis: string;
  total: string;
  montoPagado?: string;
  notas?: string;
  enlacePago?: string;
  condicionesPago?: string;
  numeroOrdenCompra?: string;
  vendedor?: string;
  direccionFacturacion?: string;
  direccionEnvio?: string;
  costoEnvio?: string;
}

@Injectable()
export class PdfService {
  async generarFacturaPdf(
    factura: Factura,
    cliente: Cliente,
    expedienteCodigo?: string,
  ): Promise<Buffer> {
    return this.generarPdf({
      tipoDocumento: 'FACTURA',
      numero: factura.numero,
      ncf: factura.ncf,
      fechaEmision: factura.fechaEmision,
      fechaVencimiento: factura.fechaVencimiento,
      estado: factura.estado.replace(/_/g, ' '),
      cliente,
      expedienteCodigo,
      concepto: factura.concepto,
      items: factura.items,
      aplicaItbis: factura.aplicaItbis,
      subtotal: factura.subtotal,
      descuento: factura.descuento,
      itbis: factura.itbis,
      total: factura.total,
      montoPagado: factura.montoPagado,
      notas: factura.notas,
      enlacePago: factura.enlacePago,
      condicionesPago: factura.condicionesPago,
      numeroOrdenCompra: factura.numeroOrdenCompra,
      vendedor: factura.vendedor,
      direccionFacturacion: factura.direccionFacturacion,
      direccionEnvio: factura.direccionEnvio,
      costoEnvio: factura.costoEnvio,
    });
  }

  async generarCotizacionPdf(
    cotizacion: Cotizacion,
    cliente: Cliente,
    expedienteCodigo?: string,
  ): Promise<Buffer> {
    return this.generarPdf({
      tipoDocumento: 'COTIZACIÓN',
      numero: cotizacion.numero,
      fechaEmision: cotizacion.creadoEn.toISOString().slice(0, 10),
      fechaVencimiento: cotizacion.validaHasta,
      estado: cotizacion.estado.replace(/_/g, ' '),
      cliente,
      expedienteCodigo,
      concepto: cotizacion.concepto,
      items: cotizacion.items,
      aplicaItbis: cotizacion.aplicaItbis,
      subtotal: cotizacion.subtotal,
      descuento: cotizacion.descuento,
      itbis: cotizacion.itbis,
      total: cotizacion.total,
      notas: cotizacion.notas,
      condicionesPago: cotizacion.condicionesPago,
      numeroOrdenCompra: cotizacion.numeroOrdenCompra,
      vendedor: cotizacion.vendedor,
      direccionFacturacion: cotizacion.direccionFacturacion,
      direccionEnvio: cotizacion.direccionEnvio,
      costoEnvio: cotizacion.costoEnvio,
    });
  }

  private async generarPdf(d: DatosDocumento): Promise<Buffer> {
    const { etiqueta, valor } = identificacionCliente(d.cliente);
    const esVencimiento = d.tipoDocumento === 'COTIZACIÓN' ? 'Válida hasta' : 'Fecha de vencimiento';

    const filasTotales: any[] = [
      ['Subtotal', formatoRD(d.subtotal)],
    ];
    if (Number(d.descuento) > 0) {
      filasTotales.push(['Descuento', `- ${formatoRD(d.descuento)}`]);
    }
    if (Number(d.itbis) > 0) {
      filasTotales.push(['ITBIS (18%)', formatoRD(d.itbis)]);
    }
    if (Number(d.costoEnvio) > 0) {
      filasTotales.push(['Envío', formatoRD(d.costoEnvio as string)]);
    }
    filasTotales.push([
      { text: 'TOTAL GENERAL (RD$)', bold: true },
      { text: formatoRD(d.total), bold: true },
    ]);
    if (d.montoPagado !== undefined) {
      const saldo = Number(d.total) - Number(d.montoPagado);
      filasTotales.push(['Monto pagado (anticipos recibidos)', formatoRD(d.montoPagado)]);
      filasTotales.push([
        { text: 'Saldo pendiente de pago', bold: true, color: '#b91c1c' },
        { text: formatoRD(saldo), bold: true, color: '#b91c1c' },
      ]);
    }

    const docDefinition: any = {
      pageSize: 'LETTER',
      pageMargins: [MARGEN, 122, MARGEN, 55],
      defaultStyle: { font: 'Helvetica', fontSize: 9.5, lineHeight: 1.2 },

      // Marca de agua institucional: el mismo logo del encabezado, centrado
      // en la página y casi transparente (6% de opacidad), detrás de todo
      // el contenido -- se repite en cada página automáticamente porque
      // pdfmake vuelve a invocar `background` por cada una.
      background: (_currentPage: number, pageSize: { width: number; height: number }) => {
        const lado = Math.min(pageSize.width, pageSize.height) * 0.55;
        return {
          image: LOGO_JAYM_BASE64,
          width: lado,
          opacity: 0.06,
          absolutePosition: { x: (pageSize.width - lado) / 2, y: (pageSize.height - lado) / 2 },
        };
      },

      header: () => ({
        margin: [MARGEN, 20, MARGEN, 0],
        stack: [
          {
            // El logo va en una columna propia de ancho fijo (en vez de una
            // posición absoluta) para que NUNCA se monte encima del texto
            // institucional centrado, sin importar qué tan larga sea cada
            // línea (teléfono, correos, etc.).
            columns: [
              {
                width: 56,
                stack: [{ image: LOGO_JAYM_BASE64, width: 50, margin: [0, 2, 0, 0] }],
              },
              {
                width: '*',
                stack: [
                  { text: MARCA_CORPORATIVA.razonSocial, bold: true, alignment: 'center', fontSize: 13, color: '#0a1e3f' },
                  {
                    text: `RNC: ${MARCA_CORPORATIVA.rnc}   ·   ${MARCA_CORPORATIVA.direccion}`,
                    alignment: 'center',
                    fontSize: 8,
                    margin: [0, 3, 0, 0],
                  },
                  {
                    text: `${MARCA_CORPORATIVA.telefono}   ·   ${MARCA_CORPORATIVA.correos.join('  ·  ')}   ·   ${MARCA_CORPORATIVA.web}`,
                    alignment: 'center',
                    fontSize: 8,
                    margin: [0, 1, 0, 0],
                  },
                  {
                    text: `"${MARCA_CORPORATIVA.eslogan}"`,
                    italics: true,
                    alignment: 'center',
                    fontSize: 8,
                    color: '#666666',
                    margin: [0, 3, 0, 6],
                  },
                ],
              },
              {
                // Columna vacía del mismo ancho que la del logo, para que el
                // bloque de texto quede realmente centrado en la hoja (y no
                // recorrido hacia la derecha por la columna del logo).
                width: 56,
                stack: [],
              },
            ],
          },
          {
            canvas: [
              { type: 'line', x1: 0, y1: 4, x2: ANCHO_CONTENIDO, y2: 4, lineWidth: 1.2, lineColor: '#b8963e' },
              { type: 'line', x1: 0, y1: 7, x2: ANCHO_CONTENIDO, y2: 7, lineWidth: 0.6, lineColor: '#5b2a86' },
            ],
          },
        ],
      }),

      footer: (currentPage: number, pageCount: number) => ({
        margin: [MARGEN, 0, MARGEN, 18],
        stack: [
          {
            canvas: [{ type: 'line', x1: 0, y1: 0, x2: ANCHO_CONTENIDO, y2: 0, lineWidth: 0.5, lineColor: '#cccccc' }],
            margin: [0, 0, 0, 4],
          },
          {
            text: `${MARCA_CORPORATIVA.razonSocial} - Página ${currentPage} de ${pageCount}`,
            alignment: 'center',
            fontSize: 7.5,
            color: '#888888',
          },
        ],
      }),

      content: [
        {
          columns: [
            {
              width: '*',
              stack: [
                { text: d.tipoDocumento, bold: true, fontSize: 16, color: '#0a1e3f' },
                { text: `No. ${d.numero}`, fontSize: 10, margin: [0, 2, 0, 0] },
                d.ncf
                  ? { text: `NCF: ${d.ncf}`, fontSize: 9, color: '#555555' }
                  : d.tipoDocumento === 'FACTURA'
                    ? { text: 'NCF: pendiente de asignar — coordinar con contabilidad/DGII', fontSize: 7.5, color: '#999999', italics: true }
                    : null,
              ].filter(Boolean),
            },
            {
              width: 210,
              stack: [
                { text: `Fecha de emisión: ${d.fechaEmision}`, fontSize: 9, alignment: 'right' },
                d.fechaVencimiento
                  ? { text: `${esVencimiento}: ${d.fechaVencimiento}`, fontSize: 9, alignment: 'right', margin: [0, 1, 0, 0] }
                  : null,
                { text: `Estado: ${d.estado}`, fontSize: 9, alignment: 'right', margin: [0, 1, 0, 0] },
                d.condicionesPago
                  ? { text: `Condiciones de pago: ${d.condicionesPago}`, fontSize: 9, alignment: 'right', margin: [0, 1, 0, 0] }
                  : null,
                d.numeroOrdenCompra
                  ? { text: `N.º de orden de compra: ${d.numeroOrdenCompra}`, fontSize: 9, alignment: 'right', margin: [0, 1, 0, 0] }
                  : null,
                d.vendedor
                  ? { text: `Vendedor: ${d.vendedor}`, fontSize: 9, alignment: 'right', margin: [0, 1, 0, 0] }
                  : null,
              ].filter(Boolean),
            },
          ],
          margin: [0, 0, 0, 14],
        },

        {
          table: { widths: ['*'], body: [[{ text: 'FACTURAR A', bold: true, fontSize: 8.5, fillColor: '#0a1e3f', color: '#b8963e', margin: [6, 4, 6, 4] }]] },
          layout: 'noBorders',
          margin: [0, 0, 0, 4],
        },
        {
          columns: [
            {
              width: '*',
              stack: [
                { text: nombreCliente(d.cliente), bold: true, fontSize: 10 },
                { text: `${etiqueta}: ${valor}`, fontSize: 9 },
                { text: d.direccionFacturacion || d.cliente.direccion || '', fontSize: 9 },
              ],
            },
            {
              width: 220,
              stack: [
                d.cliente.telefonos?.length ? { text: `Tel: ${d.cliente.telefonos.join(', ')}`, fontSize: 9, alignment: 'right' } : null,
                d.cliente.correo ? { text: d.cliente.correo, fontSize: 9, alignment: 'right', margin: [0, 1, 0, 0] } : null,
                d.expedienteCodigo ? { text: `Expediente: ${d.expedienteCodigo}`, fontSize: 9, alignment: 'right', margin: [0, 1, 0, 0] } : null,
                d.direccionEnvio
                  ? { text: `Envío a: ${d.direccionEnvio}`, fontSize: 9, alignment: 'right', margin: [0, 1, 0, 0] }
                  : null,
              ].filter(Boolean),
            },
          ],
          columnGap: 10,
          margin: [0, 0, 0, 6],
        },
        { text: d.concepto, fontSize: 9, italics: true, color: '#555555', margin: [0, 0, 0, 14] },

        {
          table: {
            headerRows: 1,
            widths: [30, 52, '*', 68, 48, 68],
            body: [
              [
                { text: 'CANT.', bold: true, fontSize: 8, fillColor: '#0a1e3f', color: '#b8963e' },
                { text: 'CÓD.', bold: true, fontSize: 8, fillColor: '#0a1e3f', color: '#b8963e' },
                { text: 'DESCRIPCIÓN DEL SERVICIO JURÍDICO', bold: true, fontSize: 8, fillColor: '#0a1e3f', color: '#b8963e' },
                { text: 'PRECIO UNIT.', bold: true, fontSize: 8, fillColor: '#0a1e3f', color: '#b8963e', alignment: 'right' },
                { text: 'ITBIS', bold: true, fontSize: 8, fillColor: '#0a1e3f', color: '#b8963e', alignment: 'center' },
                { text: 'TOTAL', bold: true, fontSize: 8, fillColor: '#0a1e3f', color: '#b8963e', alignment: 'right' },
              ],
              ...d.items.map((it) => {
                const aplicaItbisLinea = it.aplicaItbis !== undefined ? it.aplicaItbis : d.aplicaItbis;
                return [
                  { text: String(it.cantidad), fontSize: 9 },
                  { text: it.codigoArticulo || '—', fontSize: 8.5, color: '#777777' },
                  { text: it.descripcion, fontSize: 9 },
                  { text: formatoRD(it.precioUnitario), fontSize: 9, alignment: 'right' },
                  { text: aplicaItbisLinea ? '18%' : 'Exento', fontSize: 8, alignment: 'center', color: '#777777' },
                  { text: formatoRD(it.cantidad * it.precioUnitario), fontSize: 9, alignment: 'right' },
                ];
              }),
            ],
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0,
            hLineColor: () => '#dddddd',
            paddingLeft: () => 6,
            paddingRight: () => 6,
            paddingTop: () => 4,
            paddingBottom: () => 4,
          },
          margin: [0, 0, 0, 10],
        },

        {
          columns: [
            { width: '*', text: '' },
            {
              width: 240,
              table: { widths: ['*', 'auto'], body: filasTotales },
              layout: 'lightHorizontalLines',
            },
          ],
          margin: [0, 0, 0, 18],
        },

        { text: 'CONDICIONES Y POLÍTICA DE GESTIÓN', bold: true, fontSize: 9, color: '#0a1e3f', margin: [0, 0, 0, 4] },
        { text: CLAUSULA_GESTION, fontSize: 8.5, alignment: 'justify', margin: [0, 0, 0, 6] },
        { text: `Estructura de pagos: ${ESTRUCTURA_PAGOS}`, fontSize: 8.5, alignment: 'justify', margin: [0, 0, 0, 16] },

        { text: 'MÉTODOS DE PAGO', bold: true, fontSize: 9, color: '#0a1e3f', margin: [0, 0, 0, 4] },
        ...CUENTAS_BANCARIAS.flatMap((b) => [
          { text: b.banco, bold: true, fontSize: 8.5, margin: [0, 2, 0, 1] },
          ...b.cuentas.map((c) => ({ text: `${c.tipo}: ${c.numero}`, fontSize: 8.5, margin: [10, 0, 0, 0] })),
        ]),

        ...(d.enlacePago ? [
          { text: 'PAGO EN LÍNEA CON TARJETA', bold: true, fontSize: 9, color: '#0a1e3f', margin: [0, 10, 0, 4] },
          { text: 'También puedes pagar esta factura con tarjeta de crédito o débito usando este enlace seguro:', fontSize: 8.5, margin: [0, 0, 0, 2] },
          { text: d.enlacePago, fontSize: 8.5, color: '#1d4ed8', link: d.enlacePago, decoration: 'underline' },
        ] : []),
        ...(d.notas ? [{ text: 'NOTAS', bold: true, fontSize: 9, color: '#0a1e3f', margin: [0, 16, 0, 4] }, { text: d.notas, fontSize: 8.5, alignment: 'justify' }] : []),
      ],
    };

    const pdfDoc = pdfMake.createPdf(docDefinition);
    return pdfDoc.getBuffer();
  }
}
