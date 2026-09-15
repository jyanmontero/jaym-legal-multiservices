import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { ABOGADO_RESPONSABLE, MARCA_CORPORATIVA } from '../common/constants/marca-corporativa.js';

const MODELO = 'claude-sonnet-5';

export type TipoDocumentoRedaccion = 'instancia' | 'carta' | 'informe' | 'otro';

const ETIQUETAS_TIPO: Record<TipoDocumentoRedaccion, string> = {
  instancia: 'Instancia / escrito judicial o administrativo',
  carta: 'Carta / comunicación',
  informe: 'Informe',
  otro: 'Documento libre',
};

// Guía de estructura por tipo de documento -- se le añade al prompt del
// sistema según lo que el abogado elija. No son plantillas de texto fijo
// (eso ya lo cubre el catálogo de Plantillas): son instrucciones de estilo
// y de forma para que la IA redacte con la estructura que un abogado
// dominicano espera de cada tipo de documento, dejando el contenido
// concreto (hechos, fundamento, petición) a lo que el usuario describa.
const GUIA_ESTRUCTURA: Record<TipoDocumentoRedaccion, string> = {
  instancia:
    'Redacta una INSTANCIA formal dirigida a un tribunal o institución, con esta estructura y estilo (sigue el orden, pero adapta el contenido a lo que se describe): ' +
    '(1) Encabezado con el destinatario en mayúsculas (ej. "AL MAGISTRADO(A) JUEZ PRESIDENTE DE..." o el nombre de la institución), seguido de "SU DESPACHO.-" y "HONORABLE MAGISTRADO(A):" o el tratamiento que corresponda. ' +
    '(2) Un párrafo introductorio que identifica a quien suscribe (nombre, generales, calidad en la que actúa) y expone que "tiene a bien exponer lo siguiente". ' +
    '(3) Una sección "EN CUANTO A LOS HECHOS Y ANTECEDENTES" (o similar) con los hechos numerados en párrafos "PRIMERO:", "SEGUNDO:", "TERCERO:", etc., cada uno describiendo un hecho concreto en orden cronológico o lógico. ' +
    '(4) Una sección "EN CUANTO AL DERECHO" con el fundamento legal aplicable -- SOLO leyes, artículos o resoluciones que el usuario haya mencionado explícitamente en su instrucción o que consten en los documentos adjuntos; si el usuario no dio fundamento legal específico, escribe la sección en términos generales sin inventar números de artículo o de ley. ' +
    '(5) Un párrafo "POR TALES MOTIVOS," seguido de la petición concreta, numerada igual que los hechos (PRIMERO:, SEGUNDO:, etc. -- pidiendo cada cosa concreta que se solicita al tribunal). ' +
    '(6) Cierre con "Es justicia que se solicita/pide" y el lugar y fecha, y un bloque de firma con el nombre completo, cédula y calidad de quien suscribe. ' +
    '(7) Si aplica, una lista final "ANEXOS QUE SE DEPOSITAN" numerando los documentos que se acompañan (solo si el usuario los mencionó).',
  carta:
    'Redacta una CARTA formal, con esta estructura: ' +
    '(1) Lugar y fecha. ' +
    '(2) Destinatario (nombre y/o cargo e institución). ' +
    '(3) Saludo formal (ej. "Estimado(a) Sr./Sra. ___:" o el tratamiento que corresponda). ' +
    '(4) Cuerpo en párrafos claros exponiendo el motivo de la carta, según lo que el usuario describa. ' +
    '(5) Cierre cordial (ej. "Atentamente,") seguido de un bloque de firma con el nombre completo, cédula/calidad y los datos de contacto de la firma si es pertinente.',
  informe:
    'Redacta un INFORME, con esta estructura: ' +
    '(1) Título del informe en mayúsculas, y una línea con "Fecha:" y "Para:"/"De:" si el usuario dio esos datos. ' +
    '(2) Sección "ANTECEDENTES" o "CONTEXTO" resumiendo la situación de la que trata el informe. ' +
    '(3) Sección "ANÁLISIS" o "DESARROLLO" con el contenido principal, organizado en párrafos o puntos numerados según lo que el usuario describa. ' +
    '(4) Sección "CONCLUSIONES" y, si aplica, "RECOMENDACIONES". ' +
    '(5) Cierre con lugar, fecha y un bloque de firma con el nombre completo y calidad de quien lo redacta.',
  otro:
    'Redacta el documento que el usuario describa, en un tono formal jurídico dominicano, organizado en párrafos claros y, cuando tenga sentido, con secciones tituladas en mayúsculas. Si el usuario no especifica un formato, usa tu mejor criterio profesional para que el resultado se vea como un documento serio y bien estructurado.',
};

export interface ArchivoReferencia {
  buffer: Buffer;
  mimeType: string;
}

/**
 * Redacta documentos jurídicos, cartas o informes de punta a punta, sin
 * depender de ningún expediente, cliente ni plantilla del catálogo fijo de
 * `Plantillas` -- el "espacio externo" para cuando lo que el abogado
 * necesita redactar no encaja en un formulario de campos fijos (como el
 * ejemplo de instancia de partición sucesoral que dio origen a esta
 * función). El abogado describe la situación en sus propias palabras,
 * opcionalmente adjunta documentos de referencia (poder, cédulas, actas,
 * certificaciones) para que la IA tome de ahí los datos exactos, y elige
 * el tipo de documento para que la estructura sea la que corresponde.
 *
 * Igual que el resto de funciones de IA de este sistema: nunca guarda
 * nada por sí sola, nunca inventa un hecho, número, fecha o cita que no
 * pueda leer con certeza en lo que el usuario escribió o adjuntó, y el
 * resultado siempre es un BORRADOR que el abogado debe revisar antes de
 * usarlo para cualquier fin.
 */
@Injectable()
export class RedaccionService {
  private readonly logger = new Logger(RedaccionService.name);

  constructor(private readonly config: ConfigService) {}

  private cliente(): Anthropic {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new BadRequestException(
        'La función de redactar con IA todavía no está activada: falta configurar ANTHROPIC_API_KEY en el backend.',
      );
    }
    return new Anthropic({ apiKey });
  }

  private bloqueArchivo(archivo: ArchivoReferencia): Anthropic.ImageBlockParam | Anthropic.DocumentBlockParam {
    return archivo.mimeType === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: archivo.buffer.toString('base64') } }
      : {
          type: 'image',
          source: {
            type: 'base64',
            media_type: archivo.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
            data: archivo.buffer.toString('base64'),
          },
        };
  }

  async generarDocumento(
    tipoDocumento: TipoDocumentoRedaccion,
    instrucciones: string,
    archivos: ArchivoReferencia[],
  ): Promise<{ texto: string; advertencia: string }> {
    const instruccionesLimpias = String(instrucciones ?? '').trim();
    if (!instruccionesLimpias) {
      throw new BadRequestException('Describe la situación y lo que necesitas redactar.');
    }
    if (!ETIQUETAS_TIPO[tipoDocumento]) {
      throw new BadRequestException('Tipo de documento no reconocido.');
    }
    if (archivos.length > 5) {
      throw new BadRequestException('Puedes adjuntar hasta 5 documentos de referencia por borrador.');
    }

    const anthropic = this.cliente();

    const bloquesArchivos = archivos.map((archivo) => this.bloqueArchivo(archivo));
    const textoInstrucciones = archivos.length
      ? `Instrucción del abogado: ${instruccionesLimpias}\n\n(Se adjuntan ${archivos.length} documento(s) de referencia -- toma de ahí los datos exactos que necesites: nombres, cédulas, números, fechas, montos, etc.)`
      : `Instrucción del abogado: ${instruccionesLimpias}`;

    let respuesta: Anthropic.Message;
    try {
      respuesta = await anthropic.messages.create({
        model: MODELO,
        max_tokens: 4000,
        system:
          `Eres un asistente que ayuda al Licdo. Joseph Alcides Yan Montero, abogado dominicano y presidente de ${MARCA_CORPORATIVA.razonSocial}, a redactar documentos jurídicos, cartas e informes desde cero, a partir de lo que él describa. ` +
          'Redacta siempre en español, con el español jurídico formal que se usa en la República Dominicana. ' +
          `${GUIA_ESTRUCTURA[tipoDocumento]} ` +
          `Cuando el documento lleve un bloque de firma de quien lo suscribe y el usuario no haya indicado que firma otra persona, usa estos datos exactos: ${ABOGADO_RESPONSABLE.tratamiento} ${ABOGADO_RESPONSABLE.nombreCompleto}, Cédula No. ${ABOGADO_RESPONSABLE.cedula}, ${ABOGADO_RESPONSABLE.calidad}. ` +
          'Regla más importante, sin excepción: NUNCA inventes un hecho, nombre, cédula, número de sentencia/resolución/expediente/matrícula, artículo de ley, cita textual, fecha o monto que no puedas leer con certeza en la instrucción del abogado o en los documentos adjuntos. Si falta un dato necesario, escríbelo entre corchetes (ej. "[completar número de cédula]") en vez de adivinarlo o inventarlo. ' +
          'Todo lo que redactes es un BORRADOR que el abogado va a revisar, corregir y verificar por completo antes de usarlo -- nunca afirmes que un hecho, cita o dato ya fue confirmado o verificado. ' +
          'Responde ÚNICAMENTE con el texto final del documento, sin explicaciones adicionales antes o después.',
        messages: [
          {
            role: 'user',
            content: [...bloquesArchivos, { type: 'text', text: textoInstrucciones }],
          },
        ],
      });
    } catch (err) {
      this.logger.error(`Error llamando a Anthropic para redactar documento (${tipoDocumento}): ${(err as Error).message}`);
      throw new BadRequestException('No se pudo generar el borrador. Intenta de nuevo en unos minutos.');
    }

    const texto = respuesta.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    if (!texto) {
      throw new BadRequestException('No se pudo generar el borrador. Intenta reformular la instrucción.');
    }

    return {
      texto,
      advertencia: `Borrador de ${ETIQUETAS_TIPO[tipoDocumento].toLowerCase()} generado por IA -- revisa cada hecho, nombre, número, fecha, cita y artículo antes de firmarlo, enviarlo o depositarlo.`,
    };
  }
}
