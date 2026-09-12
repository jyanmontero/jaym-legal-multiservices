import { Injectable } from '@nestjs/common';
import pdfMake from 'pdfmake';
import { MARCA_CORPORATIVA } from '../../common/constants/marca-corporativa.js';
// Mismo logo institucional que ya usan facturas/cotizaciones (src/facturacion/pdf) --
// se reutiliza desde ahí en vez de duplicar el base64 en el repositorio.
import { LOGO_JAYM_BASE64 } from '../../facturacion/pdf/logo-base64.js';

// Mismo setup de fuentes que src/facturacion/pdf/pdf.service.ts -- pdfmake
// exige declarar explícitamente qué nombres de fuente/URL están permitidos,
// aunque sean los 14 fonts estándar de PDF sin archivos .ttf embebidos.
pdfMake.setFonts({
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
});
const FUENTES_PERMITIDAS = new Set(['Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique', 'Helvetica-BoldOblique']);
pdfMake.setUrlAccessPolicy(() => false);
pdfMake.setLocalAccessPolicy((ruta: string) => FUENTES_PERMITIDAS.has(ruta));

const MARGEN = 56; // ~20mm -- un contrato necesita más margen "de lectura" que una factura
const ANCHO_CONTENIDO = 500; // 612pt (carta) - 2 × 56pt de margen

// Alto del recuadro reservado para la certificación notarial (legalización
// de firmas). ~130pt (~4.5cm) alcanza para la coletilla estándar del
// notario más su sello y firma. Ver nota del usuario: los documentos
// siempre deben dejar este espacio libre al final, después de las firmas.
const ALTO_ESPACIO_NOTARIAL = 130;

@Injectable()
export class PlantillaPdfService {
  /**
   * Genera el PDF final de un documento ya aprobado. `cuerpo` ya viene con
   * todos los {{marcadores}} reemplazados (ver renderizarCuerpo en
   * plantillas-catalogo.ts) y termina con las líneas de firma de las
   * partes. pdfmake interpreta los saltos de línea ("\n") dentro de un
   * mismo bloque de texto como saltos de línea reales, así que no hace
   * falta partir el cuerpo en párrafos separados.
   */
  async generarDocumentoPdf(
    titulo: string,
    cuerpo: string,
    tamanoPagina: 'LETTER' | 'LEGAL' = 'LETTER',
    incluirEspacioNotarial = true,
  ): Promise<Buffer> {
    const docDefinition: any = {
      pageSize: tamanoPagina,
      pageMargins: [MARGEN, 92, MARGEN, 60],
      defaultStyle: { font: 'Helvetica', fontSize: 10.5, lineHeight: 1.35 },

      // Misma marca de agua institucional que facturas/cotizaciones --
      // logo centrado, casi transparente, repetido en cada página.
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
        margin: [MARGEN, 18, MARGEN, 0],
        stack: [
          {
            // Mismo truco que en facturas/cotizaciones (src/facturacion/pdf/pdf.service.ts):
            // el logo va en una columna de ancho fijo y hay una columna vacía
            // idéntica del otro lado, para que el texto central quede
            // realmente centrado en la hoja y no recorrido por el logo.
            columns: [
              { width: 42, stack: [{ image: LOGO_JAYM_BASE64, width: 36 }] },
              {
                width: '*',
                alignment: 'center',
                stack: [
                  { text: MARCA_CORPORATIVA.razonSocial, bold: true, fontSize: 10, color: '#0a1e3f' },
                  { text: MARCA_CORPORATIVA.eslogan, italics: true, fontSize: 7, color: '#888888', margin: [0, 1, 0, 0] },
                ],
              },
              { width: 42, stack: [] },
            ],
          },
          {
            canvas: [
              { type: 'line', x1: 0, y1: 6, x2: ANCHO_CONTENIDO, y2: 6, lineWidth: 1, lineColor: '#b8963e' },
              { type: 'line', x1: 0, y1: 8.5, x2: ANCHO_CONTENIDO, y2: 8.5, lineWidth: 0.5, lineColor: '#5b2a86' },
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
            text: `${MARCA_CORPORATIVA.razonSocial} · Documento generado el ${new Date().toLocaleDateString('es-DO')} · Página ${currentPage} de ${pageCount}`,
            alignment: 'center',
            fontSize: 7.5,
            color: '#888888',
          },
          {
            text: 'Generado con la asistencia de JAYM LEGAL MULTISERVICES SRL a partir de la información suministrada por las partes, y revisado y aprobado internamente antes de su entrega. No sustituye la asesoría legal individualizada.',
            alignment: 'center',
            fontSize: 6.5,
            italics: true,
            color: '#aaaaaa',
            margin: [0, 2, 0, 0],
          },
        ],
      }),

      content: [
        { text: titulo.toUpperCase(), bold: true, fontSize: 13, alignment: 'center', color: '#0a1e3f', margin: [0, 0, 0, 20] },
        { text: cuerpo, alignment: 'justify' },
        // Espacio reservado para que el Notario Público coloque su
        // coletilla de legalización de firmas (certificación, sello y
        // firma). Se deja en blanco a propósito -- no es texto del
        // contrato. `unbreakable` evita que el recuadro quede partido
        // entre dos páginas. Se omite cuando la propia plantilla ya
        // redactó la certificación notarial completa dentro del cuerpo
        // (incluirEspacioNotarial=false) -- ver poder_especial_jaym.
        ...(!incluirEspacioNotarial
          ? []
          : [{
          unbreakable: true,
          margin: [0, 26, 0, 0],
          stack: [
            {
              text: 'ESPACIO RESERVADO PARA LA CERTIFICACIÓN NOTARIAL',
              bold: true,
              fontSize: 8,
              color: '#0a1e3f',
              alignment: 'center',
            },
            {
              text: '(legalización de firmas -- uso exclusivo del Notario Público)',
              fontSize: 7,
              italics: true,
              color: '#999999',
              alignment: 'center',
              margin: [0, 2, 0, 6],
            },
            {
              canvas: [
                {
                  type: 'rect',
                  x: 0,
                  y: 0,
                  w: ANCHO_CONTENIDO,
                  h: ALTO_ESPACIO_NOTARIAL,
                  lineColor: '#cccccc',
                  lineWidth: 0.7,
                },
              ],
            },
          ],
        }]),
      ],
    };

    const pdfDoc = pdfMake.createPdf(docDefinition);
    return pdfDoc.getBuffer();
  }
}
