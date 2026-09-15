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

/**
 * Genera el resumen técnico de un caso que va en las "notas" de una
 * cotización (sección 20 del flujo principal: "Elegir el servicio" y
 * "Generar cotización o factura" van de la mano). Se apoya SOLO en lo que
 * ya está registrado en el expediente y el cliente -- nunca lee los
 * documentos adjuntos del expediente, para que sea instantáneo y no
 * dependa de qué tan legibles o voluminosos sean esos archivos.
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

  async generarResumen(expediente: Expediente, cliente: Cliente): Promise<string> {
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
        max_tokens: 600,
        system:
          `Eres un asistente que ayuda a un abogado dominicano de ${MARCA_CORPORATIVA.razonSocial} a preparar cotizaciones para sus clientes. ` +
          'Tu única tarea: escribir un resumen técnico breve (1 a 3 párrafos cortos, sin encabezados ni viñetas) del caso descrito, para colocarlo en la sección de notas de una cotización que el cliente va a leer. ' +
          'Tono profesional, claro y en español formal dominicano -- el cliente debe entender de qué trata el servicio que se le va a cotizar. ' +
          'Regla más importante, sin excepción: usa SOLO los datos que se te dan abajo. NUNCA inventes hechos, fechas, números de expediente/sentencia, artículos de ley, montos u otros datos que no estén explícitamente en la información suministrada. Si falta un dato relevante para el resumen, simplemente omítelo -- no lo señales entre corchetes ni te disculpes por no tenerlo, ya que este texto lo lee el cliente. ' +
          'No incluyas nunca montos, honorarios ni cifras -- eso lo agrega el abogado aparte. ' +
          'Responde ÚNICAMENTE con el texto del resumen, sin explicaciones adicionales antes o después.',
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

    const texto = respuesta.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    if (!texto) {
      throw new BadRequestException('No se pudo generar el resumen. Intenta de nuevo.');
    }

    return texto;
  }
}
