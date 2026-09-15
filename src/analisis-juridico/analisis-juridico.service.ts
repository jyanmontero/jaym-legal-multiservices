import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

const MODELO = 'claude-sonnet-5';

export type TipoDocumentoJuridicoDetectado =
  | 'sentencia'
  | 'resolucion'
  | 'notificacion'
  | 'informe'
  | 'oficio'
  | 'acto_alguacil'
  | 'correspondencia'
  | 'otro';

export interface AnalisisDocumentoJuridico {
  esDocumentoJuridico: boolean;
  tipoDocumento?: TipoDocumentoJuridicoDetectado;
  tribunalOInstitucion?: string;
  numero?: string;
  fecha?: string;
  partes?: string;
  resumen?: string;
  plazoAplicable?: string;
  fechaLimiteSugerida?: string;
  proximaActuacionSugerida?: string;
  categoriaDocumentoSugerida?: 'sentencias' | 'resoluciones' | 'correspondencias' | 'informes' | 'otros';
  advertencias: string;
}

const HERRAMIENTA_ANALISIS: Anthropic.Tool = {
  name: 'registrar_analisis_documento',
  description:
    'Registra el análisis de un documento jurídico (sentencia, resolución, notificación, informe, oficio, acto de alguacil, correspondencia, etc.) leído en la imagen o PDF adjunto.',
  input_schema: {
    type: 'object',
    properties: {
      esDocumentoJuridico: {
        type: 'boolean',
        description:
          'true si el archivo es claramente un documento jurídico/administrativo relacionado con un caso (sentencia, resolución, notificación, acto, informe, oficio, correspondencia de un tribunal o institución, etc.). false si es cualquier otra cosa o es ilegible.',
      },
      tipoDocumento: {
        type: 'string',
        enum: ['sentencia', 'resolucion', 'notificacion', 'informe', 'oficio', 'acto_alguacil', 'correspondencia', 'otro'],
        description: 'Tipo de documento, el que mejor describa lo que se leyó.',
      },
      tribunalOInstitucion: {
        type: 'string',
        description: 'Tribunal, juzgado o institución que emite el documento, tal como aparece. Omitir si no es claro.',
      },
      numero: {
        type: 'string',
        description: 'Número de sentencia, resolución, expediente u oficio, tal como aparece en el documento. Omitir si no se lee con claridad.',
      },
      fecha: {
        type: 'string',
        description: 'Fecha del documento (o de notificación, si es lo más relevante), en formato YYYY-MM-DD. Omitir si no es clara.',
      },
      partes: {
        type: 'string',
        description: 'Partes involucradas y su rol, en una línea breve (ej. "Demandante: Juan Pérez — Demandado: María Gómez"). Omitir si no aplica o no es claro.',
      },
      resumen: {
        type: 'string',
        description: 'Resumen breve (3 a 6 líneas) del contenido o de la parte dispositiva del documento, en español, para que el abogado entienda de qué trata sin tener que leerlo completo.',
      },
      plazoAplicable: {
        type: 'string',
        description:
          'Explicación en términos generales de qué plazo aplicaría y para qué acción (ej. "plazo para recurrir en apelación"), SOLO si el tipo de decisión lo amerita. Nunca inventes un número de artículo o ley específico si no estás seguro -- descríbelo en términos generales. Omitir si no aplica.',
      },
      fechaLimiteSugerida: {
        type: 'string',
        description:
          'Fecha límite sugerida en formato YYYY-MM-DD, calculada SOLO si hay una fecha de notificación clara y un plazo estándar bien conocido. Esta es una sugerencia que el abogado debe verificar siempre -- omitir si hay cualquier duda.',
      },
      proximaActuacionSugerida: {
        type: 'string',
        description: 'Descripción breve de la siguiente acción recomendada (ej. "Preparar y depositar recurso de apelación"). Omitir si no aplica.',
      },
      categoriaDocumentoSugerida: {
        type: 'string',
        enum: ['sentencias', 'resoluciones', 'correspondencias', 'informes', 'otros'],
        description: 'Categoría sugerida para clasificar este documento si se sube al expediente.',
      },
      advertencias: {
        type: 'string',
        description:
          'Notas breves en español sobre cualquier duda, dato ilegible, recorte, o cualquier motivo por el que el abogado deba revisar el original con cuidado. Cadena vacía si no hay ninguna advertencia.',
      },
    },
    required: ['esDocumentoJuridico', 'advertencias'],
  },
};

/**
 * Lee cualquier documento jurídico (sentencia, resolución, notificación,
 * informe, oficio, acto de alguacil, correspondencia, etc.) usando el
 * modelo de visión de Claude, y devuelve un análisis estructurado --
 * nunca crea ni modifica nada por sí sola. El abogado revisa el resultado
 * y decide si lo usa para agregar una entrada al seguimiento del
 * expediente y/o actualizar la próxima actuación o la fecha límite
 * (ambas acciones se hacen con los endpoints normales de expedientes /
 * seguimiento, ya existentes -- este servicio solo analiza y sugiere).
 *
 * ADVERTENCIA que se traslada también al usuario final: un modelo de
 * lenguaje puede inventar plazos, artículos o fechas si no tiene certeza.
 * Por eso el resultado siempre debe tratarse como una sugerencia a
 * verificar, nunca como un hecho confirmado.
 */
@Injectable()
export class AnalisisJuridicoService {
  private readonly logger = new Logger(AnalisisJuridicoService.name);

  constructor(private readonly config: ConfigService) {}

  private cliente(): Anthropic {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new BadRequestException(
        'La función de analizar documentos con IA todavía no está activada: falta configurar ANTHROPIC_API_KEY en el backend.',
      );
    }
    return new Anthropic({ apiKey });
  }

  async analizarDocumento(buffer: Buffer, mimeType: string): Promise<AnalisisDocumentoJuridico> {
    const anthropic = this.cliente();
    const base64 = buffer.toString('base64');

    const bloqueArchivo: Anthropic.ImageBlockParam | Anthropic.DocumentBlockParam =
      mimeType === 'application/pdf'
        ? {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64 },
          }
        : {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: base64,
            },
          };

    let respuesta: Anthropic.Message;
    try {
      respuesta = await anthropic.messages.create({
        model: MODELO,
        max_tokens: 1500,
        system:
          'Eres un asistente que ayuda a un abogado dominicano de JAYM LEGAL MULTISERVICES a analizar documentos jurídicos y administrativos recibidos en un caso (sentencias, resoluciones, notificaciones, informes, oficios, actos de alguacil, correspondencias, etc.). ' +
          'Extrae ÚNICAMENTE lo que se lea con claridad razonable -- nunca inventes un número de sentencia, artículo de ley, plazo o fecha que no conozcas con certeza. Si tienes duda sobre un plazo legal exacto, descríbelo en términos generales y dilo en las advertencias. ' +
          'Este análisis es una sugerencia que el abogado va a revisar y verificar antes de actuar -- nunca afirmes que un plazo o dato ya fue confirmado. ' +
          'Si el documento no es jurídico/administrativo o es ilegible, indícalo en esDocumentoJuridico=false y explica por qué en advertencias. ' +
          'Usa siempre la herramienta registrar_analisis_documento para responder.',
        tools: [HERRAMIENTA_ANALISIS],
        tool_choice: { type: 'tool', name: 'registrar_analisis_documento' },
        messages: [
          {
            role: 'user',
            content: [
              bloqueArchivo,
              { type: 'text', text: 'Analiza este documento jurídico y extrae los datos que puedas con confianza.' },
            ],
          },
        ],
      });
    } catch (err) {
      this.logger.error(`Error llamando a Anthropic para analizar documento jurídico: ${(err as Error).message}`);
      throw new BadRequestException('No se pudo procesar el documento. Intenta con una foto o escaneo más claro, o inténtalo de nuevo en unos minutos.');
    }

    const bloqueHerramienta = respuesta.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'registrar_analisis_documento',
    );

    if (!bloqueHerramienta) {
      throw new BadRequestException('No se pudo analizar el documento. Intenta con una foto o escaneo más claro.');
    }

    return bloqueHerramienta.input as AnalisisDocumentoJuridico;
  }
}
