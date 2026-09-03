import { Injectable } from '@nestjs/common';
import pdfMake from 'pdfmake';
import { MARCA_CORPORATIVA } from '../../common/constants/marca-corporativa.js';

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

@Injectable()
export class PlantillaPdfService {
  /**
   * Genera el PDF final de un documento ya aprobado. `cuerpo` ya viene con
   * todos los {{marcadores}} reemplazados (ver renderizarCuerpo en
   * plantillas-catalogo.ts). pdfmake interpreta los saltos de línea ("\n")
   * dentro de un mismo bloque de texto como saltos de línea reales, así que
   * no hace falta partir el cuerpo en párrafos separados.
   */
  async generarDocumentoPdf(titulo: string, cuerpo: string): Promise<Buffer> {
    const docDefinition: any = {
      pageSize: 'LETTER',
      pageMargins: [MARGEN, 70, MARGEN, 50],
      defaultStyle: { font: 'Helvetica', fontSize: 10.5, lineHeight: 1.35 },

      footer: (currentPage: number, pageCount: number) => ({
        margin: [MARGEN, 0, MARGEN, 18],
        stack: [
          {
            canvas: [{ type: 'line', x1: 0, y1: 0, x2: 500, y2: 0, lineWidth: 0.5, lineColor: '#cccccc' }],
            margin: [0, 0, 0, 4],
          },
          {
            text: `${MARCA_CORPORATIVA.razonSocial} · Documento generado el ${new Date().toLocaleDateString('es-DO')} · Página ${currentPage} de ${pageCount}`,
            alignment: 'center',
            fontSize: 7.5,
            color: '#888888',
          },
        ],
      }),

      content: [
        { text: titulo.toUpperCase(), bold: true, fontSize: 13, alignment: 'center', color: '#0a1e3f', margin: [0, 0, 0, 20] },
        { text: cuerpo, alignment: 'justify' },
        {
          text: 'Este documento fue generado con la asistencia de JAYM LEGAL MULTISERVICES SRL a partir de la información suministrada por las partes, y fue revisado y aprobado internamente antes de su entrega. No sustituye la asesoría legal individualizada.',
          fontSize: 7.5,
          italics: true,
          color: '#888888',
          margin: [0, 30, 0, 0],
        },
      ],
    };

    const pdfDoc = pdfMake.createPdf(docDefinition);
    return pdfDoc.getBuffer();
  }
}
