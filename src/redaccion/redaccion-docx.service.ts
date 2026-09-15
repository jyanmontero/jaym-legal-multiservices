import { Injectable } from '@nestjs/common';
import {
  AlignmentType,
  Document,
  Header,
  ImageRun,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';
import { LOGO_JAYM_BASE64 } from '../facturacion/pdf/logo-base64.js';
import { MARCA_CORPORATIVA } from '../common/constants/marca-corporativa.js';
import type { TipoDocumentoRedaccion } from './redaccion.service.js';

const PREFIJO_DATA_URI = 'data:image/png;base64,';
const LOGO_BUFFER = Buffer.from(LOGO_JAYM_BASE64.replace(PREFIJO_DATA_URI, ''), 'base64');

const MARGEN_TWIPS = 1440; // 1 pulgada
const FUENTE = 'Times New Roman';
const TAMANO_TEXTO = 24; // 12pt (docx mide "half-points": 24 = 12pt)
const TAMANO_TITULO = 26; // 13pt

// Tipos de documento que llevan el membrete institucional de JAYM Legal
// (cartas e informes salen de la firma como correspondencia propia).
// Las instancias/escritos judiciales y "otro" se dejan sin membrete,
// como corresponde a un documento que se deposita ante un tribunal o
// institución -- igual que el ejemplo real que dio origen a esta función.
const TIPOS_CON_MEMBRETE = new Set<TipoDocumentoRedaccion>(['carta', 'informe']);

function esLineaTitulo(linea: string): boolean {
  const sinPuntuacion = linea.replace(/[^\p{L}]/gu, '');
  if (sinPuntuacion.length < 3) return false;
  return linea === linea.toUpperCase() && linea.length < 140;
}

function esLineaFirma(linea: string): boolean {
  return /^_{5,}$/.test(linea.trim());
}

/**
 * Convierte el texto plano de un borrador (ya redactado o editado por el
 * abogado) en un archivo .docx con formato de documento jurídico
 * dominicano: márgenes de una pulgada, Times New Roman 12pt, párrafos
 * justificados, líneas completamente en mayúsculas tratadas como títulos
 * (centradas y en negrita), y una línea de "_______" tratada como el
 * renglón de una firma (centrada). No interpreta nada más del contenido --
 * el abogado revisa y ajusta el resultado final directamente en Word.
 */
@Injectable()
export class RedaccionDocxService {
  async generarDocx(tipoDocumento: TipoDocumentoRedaccion, texto: string): Promise<Buffer> {
    const lineas = String(texto ?? '').replace(/\r\n/g, '\n').split('\n');

    const parrafos: Paragraph[] = lineas.map((lineaOriginal) => {
      const linea = lineaOriginal.trim();

      if (!linea) {
        return new Paragraph({ children: [new TextRun({ text: '', font: FUENTE, size: TAMANO_TEXTO })], spacing: { after: 120 } });
      }

      if (esLineaFirma(linea)) {
        return new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 300, after: 60 },
          children: [new TextRun({ text: linea, font: FUENTE, size: TAMANO_TEXTO })],
        });
      }

      if (esLineaTitulo(linea)) {
        return new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 200 },
          children: [new TextRun({ text: linea, font: FUENTE, size: TAMANO_TITULO, bold: true })],
        });
      }

      return new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 200 },
        children: [new TextRun({ text: linea, font: FUENTE, size: TAMANO_TEXTO })],
      });
    });

    const conMembrete = TIPOS_CON_MEMBRETE.has(tipoDocumento);

    const documento = new Document({
      sections: [
        {
          properties: {
            page: { margin: { top: MARGEN_TWIPS, bottom: MARGEN_TWIPS, left: MARGEN_TWIPS, right: MARGEN_TWIPS } },
          },
          headers: conMembrete
            ? {
                default: new Header({
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [new ImageRun({ type: 'png', data: LOGO_BUFFER, transformation: { width: 42, height: 42 } })],
                    }),
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new TextRun({ text: MARCA_CORPORATIVA.razonSocial, font: FUENTE, size: 20, bold: true, color: '0A1E3F' }),
                      ],
                    }),
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      spacing: { after: 200 },
                      children: [
                        new TextRun({ text: MARCA_CORPORATIVA.eslogan, font: FUENTE, size: 16, italics: true, color: '888888' }),
                      ],
                    }),
                  ],
                }),
              }
            : undefined,
          children: parrafos,
        },
      ],
    });

    return Packer.toBuffer(documento);
  }
}
