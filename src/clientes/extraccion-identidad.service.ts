import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

const MODELO = 'claude-sonnet-5';

export interface DatosIdentidadExtraidos {
  esDocumentoIdentidad: boolean;
  tipoDocumentoDetectado?: 'cedula' | 'pasaporte' | 'otro';
  nombres?: string;
  apellidos?: string;
  cedula?: string;
  pasaporte?: string;
  nacionalidad?: string;
  fechaNacimiento?: string;
  advertencias?: string;
}

const HERRAMIENTA_EXTRACCION: Anthropic.Tool = {
  name: 'extraer_datos_identidad',
  description:
    'Registra los datos de identidad que se lograron leer, con claridad razonable, en la imagen o PDF de una cédula dominicana o un pasaporte.',
  input_schema: {
    type: 'object',
    properties: {
      esDocumentoIdentidad: {
        type: 'boolean',
        description: 'true si la imagen/PDF es claramente una cédula de identidad, pasaporte u otro documento oficial de identificación de una persona física. false si es cualquier otra cosa (otro tipo de documento, foto irrelevante, imagen ilegible, etc.).',
      },
      tipoDocumentoDetectado: {
        type: 'string',
        enum: ['cedula', 'pasaporte', 'otro'],
      },
      nombres: { type: 'string', description: 'Nombres de pila, tal como aparecen en el documento. Omitir si no son legibles.' },
      apellidos: { type: 'string', description: 'Apellidos, tal como aparecen en el documento. Omitir si no son legibles.' },
      cedula: { type: 'string', description: 'Número de cédula dominicana, formato 000-0000000-0. Solo si el documento es una cédula y el número se lee con claridad.' },
      pasaporte: { type: 'string', description: 'Número de pasaporte. Solo si el documento es un pasaporte y el número se lee con claridad.' },
      nacionalidad: { type: 'string', description: 'Nacionalidad de la persona, si se indica o se puede inferir con certeza del documento (ej. "Dominicana"). Omitir si no hay certeza.' },
      fechaNacimiento: { type: 'string', description: 'Fecha de nacimiento en formato YYYY-MM-DD, solo si aparece con claridad en el documento.' },
      advertencias: {
        type: 'string',
        description: 'Notas breves en español sobre cualquier dato que no se pudo leer con confianza, que se ve borroso, recortado, o cualquier duda relevante. Cadena vacía si no hay ninguna advertencia.',
      },
    },
    required: ['esDocumentoIdentidad'],
  },
};

/**
 * Lee una foto o PDF de una cédula dominicana o pasaporte usando el modelo
 * de visión de Claude, y devuelve los datos que logró extraer para
 * pre-llenar el formulario de "Nuevo cliente" -- nunca crea ni modifica
 * ningún registro por sí sola. El usuario siempre revisa y confirma antes
 * de guardar. La imagen se envía a la API de Anthropic para su lectura y no
 * se guarda en ningún lado por este servicio.
 */
@Injectable()
export class ExtraccionIdentidadService {
  private readonly logger = new Logger(ExtraccionIdentidadService.name);

  constructor(private readonly config: ConfigService) {}

  private cliente(): Anthropic {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new BadRequestException(
        'La función de escanear documentos de identidad todavía no está activada: falta configurar ANTHROPIC_API_KEY en el backend.',
      );
    }
    return new Anthropic({ apiKey });
  }

  async extraerDeArchivo(buffer: Buffer, mimeType: string): Promise<DatosIdentidadExtraidos> {
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
        max_tokens: 1024,
        system:
          'Eres un asistente que ayuda al personal de JAYM LEGAL MULTISERVICES (despacho de abogados dominicano) a registrar clientes nuevos leyendo su cédula o pasaporte. Extrae ÚNICAMENTE lo que se lea con claridad razonable en la imagen o PDF adjunto -- nunca inventes ni adivines un dato que no esté visible. Si el documento no es una cédula o pasaporte, o es ilegible, indícalo. Usa siempre la herramienta extraer_datos_identidad para responder.',
        tools: [HERRAMIENTA_EXTRACCION],
        tool_choice: { type: 'tool', name: 'extraer_datos_identidad' },
        messages: [
          {
            role: 'user',
            content: [
              bloqueArchivo,
              { type: 'text', text: 'Lee este documento de identidad y extrae los datos que puedas con confianza.' },
            ],
          },
        ],
      });
    } catch (err) {
      this.logger.error(`Error llamando a Anthropic para extraer identidad: ${(err as Error).message}`);
      throw new BadRequestException('No se pudo procesar el documento. Intenta con una foto más clara o inténtalo de nuevo en unos minutos.');
    }

    const bloqueHerramienta = respuesta.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'extraer_datos_identidad',
    );

    if (!bloqueHerramienta) {
      throw new BadRequestException('No se pudo leer el documento. Intenta con una foto más clara.');
    }

    return bloqueHerramienta.input as DatosIdentidadExtraidos;
  }
}
