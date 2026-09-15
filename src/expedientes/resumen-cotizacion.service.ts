import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { Expediente } from './expediente.entity.js';
import { Cliente } from '../clientes/cliente.entity.js';
import { MARCA_CORPORATIVA } from '../common/constants/marca-corporativa.js';

const MODELO = 'claude-sonnet-5';

function nombreCliente(cliente: Cliente): string {
  if (cliente.razonSocial) return cliente.razonSocial;
  return [cliente.nombres, cliente.apellidos].filter(Boolean).join(' ') || 'Cliente sin nombre registrado';
}

const HERRAMIENTA_RESUMEN: Anthropic.Tool = {
  name: 'registrar_resumen_cotizacion',
  description: 'Registra el resumen técnico y el concepto breve del servicio para una cotización.',
  input_schema: {
    type: 'object',
    properties: {
      resumen: {
        type: 'string',
        description:
          'Resumen técnico del caso (1 a 3 párrafos cortos, sin encabezados ni viñetas) para la sección de notas de la cotización -- lo lee el cliente.',
      },
      conceptoBreve: {
        type: 'string',
        description:
          'Descripción muy breve (máximo 12 palabras, sin punto final) del servicio jurídico concreto que se presta en este caso, para usar en la línea de "Descripción" de un ítem de cotización -- ej. "homologación de partición amigable de inmueble heredado" o "demanda en nulidad de reconocimiento de paternidad". Específico al caso, no genérico.',
      },
    },
    required: ['resumen', 'conceptoBreve'],
  },
};

/**
 * Genera el resumen técnico y el concepto breve de un caso para preparar
 * una cotización (sección 20 del flujo principal: "Elegir el servicio" y
 * "Generar cotización o factura" van de la mano). Se apoya SOLO en lo que
 * ya está registrado en el expediente y el cliente -- nunca lee los
 * documentos adjuntos del expediente, para que sea instantáneo y no
 * dependa de qué tan legibles o voluminosos sean esos archivos.
 *
 * `conceptoBreve` existe porque una cotización con líneas genéricas como
 * "Honorarios profesionales" / "Costos del proceso" no le dice nada al
 * cliente sobre qué se le está cobrando -- se usa para armar una
 * descripción de línea específica al caso (ver ExpedienteDetailPage).
 *
 * Como el resto de funciones de IA de este sistema: nunca inventa un
 * dato que no esté en el expediente, y el abogado revisa/edita el texto
 * antes de que se cree la cotización -- ver RedaccionService para el
 * mismo principio aplicado a documentos libres.
 */
@Injectable()
export class ResumenCotizacionService {
  private readonly logger = new Logger(ResumenCotizacionService.name);

  constructor(private readonly config: ConfigService) {}

  private cliente(): Anthropic {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new BadRequestException(
        'La función de resumen con IA todavía no está activada: falta configurar ANTHROPIC_API_KEY en el backend.',
      );
    }
    return new Anthropic({ apiKey });
  }

  async generarResumen(expediente: Expediente, cliente: Cliente): Promise<{ resumen: string; conceptoBreve: string }> {
    const anthropic = this.cliente();

    const datos = [
      `Código de expediente: ${expediente.codigo}`,
      `Cliente: ${nombreCliente(cliente)}`,
      expediente.contraparte ? `Contraparte: ${expediente.contraparte}` : null,
      `Materia: ${expediente.materia.replace(/_/g, ' ')}`,
      expediente.tipoServicio ? `Tipo de servicio: ${expediente.tipoServicio}` : null,
      expediente.tribunalInstitucion ? `Tribunal o institución: ${expediente.tribunalInstitucion}` : null,
      expediente.descripcion ? `Descripción del caso: ${expediente.descripcion}` : null,
      expediente.objetivo ? `Objetivo del proceso: ${expediente.objetivo}` : null,
      `Estado actual: ${expediente.estado.replace(/_/g, ' ')}`,
    ]
      .filter(Boolean)
      .join('\n');

    let respuesta: Anthropic.Message;
    try {
      respuesta = await anthropic.messages.create({
        model: MODELO,
        max_tokens: 700,
        system:
          `Eres un asistente que ayuda a un abogado dominicano de ${MARCA_CORPORATIVA.razonSocial} a preparar cotizaciones para sus clientes. ` +
          'Tono profesional, claro y en español formal dominicano -- el cliente debe entender de qué trata el servicio que se le va a cotizar. ' +
          'Regla más importante, sin excepción: usa SOLO los datos que se te dan abajo. NUNCA inventes hechos, fechas, números de expediente/sentencia, artículos de ley, montos u otros datos que no estén explícitamente en la información suministrada. Si falta un dato relevante, simplemente omítelo -- no lo señales entre corchetes ni te disculpes por no tenerlo, ya que este texto lo lee el cliente. ' +
          'No incluyas nunca montos, honorarios ni cifras -- eso lo agrega el abogado aparte. ' +
          'Usa siempre la herramienta registrar_resumen_cotizacion para responder.',
        tools: [HERRAMIENTA_RESUMEN],
        tool_choice: { type: 'tool', name: 'registrar_resumen_cotizacion' },
        messages: [
          {
            role: 'user',
            content: `Datos del expediente:\n${datos}`,
          },
        ],
      });
    } catch (err) {
      this.logger.error(`Error llamando a Anthropic para resumen de cotización (expediente ${expediente.id}): ${(err as Error).message}`);
      throw new BadRequestException('No se pudo generar el resumen. Intenta de nuevo en unos minutos.');
    }

    const bloqueHerramienta = respuesta.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'registrar_resumen_cotizacion',
    );

    if (!bloqueHerramienta) {
      throw new BadRequestException('No se pudo generar el resumen. Intenta de nuevo.');
    }

    const resultado = bloqueHerramienta.input as { resumen?: string; conceptoBreve?: string };
    if (!resultado.resumen || !resultado.conceptoBreve) {
      throw new BadRequestException('No se pudo generar el resumen. Intenta de nuevo.');
    }

    return { resumen: resultado.resumen.trim(), conceptoBreve: resultado.conceptoBreve.trim() };
  }
}
