import ExcelJS from 'exceljs';
import pdfMake from 'pdfmake';
import { MARCA_CORPORATIVA } from '../common/constants/marca-corporativa.js';

// Mismo criterio que facturacion/pdf/pdf.service.ts: pdfmake exige declarar
// explícitamente los fonts y las políticas de acceso local/URL (no hay
// imágenes ni rutas externas en estos reportes, solo texto y tablas).
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

export interface ColumnaReporte {
  header: string;
  key: string;
  width?: number;
  /** Formatea el valor crudo de la fila para mostrarlo (Excel y PDF). */
  formato?: (valor: any, fila: Record<string, any>) => string;
}

export interface DatosReporte {
  titulo: string;
  /** Texto libre bajo el título -- ej. "Del 01/09/2026 al 15/09/2026". */
  subtitulo?: string;
  columnas: ColumnaReporte[];
  filas: Record<string, any>[];
  /** Líneas de resumen al final (ej. totales) -- se muestran en ambos formatos. */
  resumen?: { etiqueta: string; valor: string }[];
}

function valorCelda(col: ColumnaReporte, fila: Record<string, any>): string {
  const crudo = fila[col.key];
  if (col.formato) return col.formato(crudo, fila);
  if (crudo === null || crudo === undefined) return '—';
  return String(crudo);
}

export async function generarExcelReporte(datos: DatosReporte): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  libro.creator = MARCA_CORPORATIVA.razonSocial;
  libro.created = new Date();

  const hoja = libro.addWorksheet(datos.titulo.slice(0, 31) || 'Reporte');

  hoja.mergeCells(1, 1, 1, datos.columnas.length);
  const celdaTitulo = hoja.getCell(1, 1);
  celdaTitulo.value = `${MARCA_CORPORATIVA.razonSocial} — ${datos.titulo}`;
  celdaTitulo.font = { bold: true, size: 13, color: { argb: 'FF0A1E3F' } };

  let filaActual = 2;
  if (datos.subtitulo) {
    hoja.mergeCells(filaActual, 1, filaActual, datos.columnas.length);
    hoja.getCell(filaActual, 1).value = datos.subtitulo;
    hoja.getCell(filaActual, 1).font = { italic: true, size: 10, color: { argb: 'FF555555' } };
    filaActual += 1;
  }
  hoja.mergeCells(filaActual, 1, filaActual, datos.columnas.length);
  hoja.getCell(filaActual, 1).value = `Generado el ${new Date().toLocaleString('es-DO', { dateStyle: 'long', timeStyle: 'short' })}`;
  hoja.getCell(filaActual, 1).font = { size: 9, color: { argb: 'FF888888' } };
  filaActual += 2;

  const filaEncabezado = hoja.getRow(filaActual);
  datos.columnas.forEach((col, i) => {
    const celda = filaEncabezado.getCell(i + 1);
    celda.value = col.header;
    celda.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A1E3F' } };
    celda.alignment = { vertical: 'middle' };
    hoja.getColumn(i + 1).width = col.width ?? 22;
  });
  filaActual += 1;

  for (const fila of datos.filas) {
    const filaHoja = hoja.getRow(filaActual);
    datos.columnas.forEach((col, i) => {
      filaHoja.getCell(i + 1).value = valorCelda(col, fila);
    });
    filaActual += 1;
  }

  if (datos.resumen?.length) {
    filaActual += 1;
    for (const r of datos.resumen) {
      hoja.getCell(filaActual, 1).value = r.etiqueta;
      hoja.getCell(filaActual, 1).font = { bold: true };
      hoja.getCell(filaActual, 2).value = r.valor;
      hoja.getCell(filaActual, 2).font = { bold: true };
      filaActual += 1;
    }
  }

  if (datos.filas.length === 0) {
    hoja.getCell(filaActual, 1).value = 'Sin resultados para los filtros seleccionados.';
    hoja.getCell(filaActual, 1).font = { italic: true, color: { argb: 'FF888888' } };
  }

  const buffer = await libro.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function generarPdfReporte(datos: DatosReporte): Promise<Buffer> {
  const anchoColumna = (): any => '*';

  const cuerpoTabla = [
    datos.columnas.map((c) => ({ text: c.header, bold: true, color: '#ffffff', fontSize: 8.5 })),
    ...datos.filas.map((fila) => datos.columnas.map((c) => ({ text: valorCelda(c, fila), fontSize: 8 }))),
  ];

  const docDefinition: any = {
    pageSize: 'LETTER',
    pageMargins: [30, 40, 30, 40],
    defaultStyle: { font: 'Helvetica' },
    content: [
      { text: MARCA_CORPORATIVA.razonSocial, bold: true, fontSize: 13, color: '#0a1e3f' },
      { text: datos.titulo, bold: true, fontSize: 15, margin: [0, 2, 0, 0] },
      ...(datos.subtitulo ? [{ text: datos.subtitulo, italics: true, fontSize: 9.5, color: '#555555', margin: [0, 2, 0, 0] }] : []),
      {
        text: `Generado el ${new Date().toLocaleString('es-DO', { dateStyle: 'long', timeStyle: 'short' })}`,
        fontSize: 8,
        color: '#888888',
        margin: [0, 2, 0, 10],
      },
      datos.filas.length === 0
        ? { text: 'Sin resultados para los filtros seleccionados.', italics: true, color: '#888888' }
        : {
            table: {
              headerRows: 1,
              widths: datos.columnas.map(anchoColumna),
              body: cuerpoTabla,
            },
            layout: {
              fillColor: (rowIndex: number) => (rowIndex === 0 ? '#0a1e3f' : rowIndex % 2 === 0 ? '#f5f6f8' : null),
              hLineColor: () => '#dddddd',
              vLineColor: () => '#dddddd',
            },
          },
      ...(datos.resumen?.length
        ? [
            { text: ' ', margin: [0, 6, 0, 0] },
            ...datos.resumen.map((r) => ({
              text: `${r.etiqueta}: ${r.valor}`,
              bold: true,
              fontSize: 9.5,
              margin: [0, 1, 0, 0],
            })),
          ]
        : []),
    ],
    footer: (paginaActual: number, totalPaginas: number) => ({
      text: `${MARCA_CORPORATIVA.eslogan} — Página ${paginaActual} de ${totalPaginas}`,
      alignment: 'center',
      fontSize: 7.5,
      color: '#999999',
      margin: [0, 6, 0, 0],
    }),
  };

  const pdfDoc = pdfMake.createPdf(docDefinition);
  return pdfDoc.getBuffer();
}
