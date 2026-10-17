import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

const MODELO = 'claude-sonnet-5';

export interface DatosFacturaGastoExtraidos {
  esFacturaOComprobante: boolean;
  proveedorNombre?: string;
  proveedorIdentificacion?: string;
  ncf?: string;
  ncfModificado?: string;
  fechaComprobante?: string;
  montoServicios?: number;
  montoBienes?: number;
  itbisFacturado?: number;
  otrosImpuestos?: number;
  propinaLegal?: number;
  total?: number;
  moneda?: string;
  concepto?: string;
  advertencias?: string;
}

const HERRAMIENTA: Anthropic.Tool = {
  name: 'extraer_factura_gasto',
  description:
    'Registra los datos que se lograron leer con claridad en la foto o PDF de una factura de compra o gasto con comprobante fiscal dominicano (NCF o e-NCF).',
  input_schema: {
    type: 'object',
    properties: {
      esFacturaOComprobante: {
        type: 'boolean',
        description: 'true solo si es una factura, comprobante fiscal, ticket o recibo de compra legible. false si es otra cosa o es ilegible.',
      },
      proveedorNombre: { type: 'string', description: 'Razón social o nombre del vendedor/proveedor que emite la factura (no el comprador).' },
      proveedorIdentificacion: { type: 'string', description: 'RNC (9 dígitos) o cédula (11 dígitos) del proveedor/emisor, solo dígitos si se lee con claridad. No el del comprador.' },
      ncf: { type: 'string', description: 'Número de Comprobante Fiscal completo (ej. B0100000123 o E310000000123), tal como aparece. Omitir si no se lee con claridad.' },
      ncfModificado: { type: 'string', description: 'Solo si es nota de crédito/débito: NCF del comprobante que modifica.' },
      fechaComprobante: { type: 'string', description: 'Fecha de emisión en formato YYYY-MM-DD.' },
      montoServicios: { type: 'number', description: 'Monto facturado por servicios, SIN ITBIS y después de descuentos. 0 si no hay.' },
      montoBienes: { type: 'number', description: 'Monto facturado por bienes/productos, SIN ITBIS y después de descuentos. 0 si no hay. Si no se puede separar bienes de servicios, ponlo todo en bienes o servicios según lo que predomine y avísalo en advertencias.' },
      itbisFacturado: { type: 'number', description: 'ITBIS (18% u otra tasa) cobrado en la factura. 0 si es exenta o no aparece.' },
      otrosImpuestos: { type: 'number', description: 'Otros impuestos o tasas distintos de ITBIS y propina (ISC, tasas). 0 si no hay.' },
      propinaLegal: { type: 'number', description: 'Propina legal (10%) si aparece. 0 si no hay.' },
      total: { type: 'number', description: 'Total a pagar que aparece en la factura.' },
      moneda: { type: 'string', enum: ['DOP', 'USD', 'EUR'] },
      concepto: { type: 'string', description: 'Descripción breve (máx. 120 caracteres) de lo comprado.' },
      advertencias: {
        type: 'string',
        description: 'Notas breves en español sobre datos borrosos, cortados, dudosos o supuestos que hiciste. Cadena vacía si no hay.',
      },
    },
    required: ['esFacturaOComprobante'],
  },
};

/**
 * Lee una foto o PDF de una factura de compra con el modelo de visión de
 * Claude y devuelve una PROPUESTA de datos. Nunca guarda nada: una persona
 * revisa y corrige el formulario antes de confirmar. El archivo se envía a la
 * API de Anthropic solo para su lectura. Usa la misma ANTHROPIC_API_KEY (variable
 * de entorno del backend) que la lectura de cédulas y el asistente.
 */
@Injectable()
export class ExtraccionFacturaGastoService {
  private readonly logger = new Logger(ExtraccionFacturaGastoService.name);

  constructor(private readonly config: ConfigService) {}

  private cliente(): Anthropic {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new BadRequestException(
        'La lectura automática de facturas todavía no está activada: falta configurar ANTHROPIC_API_KEY en el backend. Mientras tanto puedes escribir los datos a mano.',
      );
    }
    return new Anthropic({ apiKey });
  }

  async extraer(buffer: Buffer, mimeType: string): Promise<DatosFacturaGastoExtraidos> {
    const anthropic = this.cliente();
    const base64 = buffer.toString('base64');
    const bloque: Anthropic.ImageBlockParam | Anthropic.DocumentBlockParam =
      mimeType === 'application/pdf'
        ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
        : {
            type: 'image',
            source: { type: 'base64', media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: base64 },
          };

    let respuesta: Anthropic.Message;
    try {
      respuesta = await anthropic.messages.create({
        model: MODELO,
        max_tokens: 1200,
        system:
          'Eres un asistente que ayuda al personal administrativo de JAYM LEGAL MULTISERVICES (despacho de abogados dominicano, RNC 133540772) a registrar facturas de gastos. El proveedor es quien EMITE la factura; la firma es la compradora. Extrae ÚNICAMENTE lo que se lea con claridad en el archivo: nunca inventes ni adivines RNC, NCF, fechas ni montos. Los montos van sin ITBIS en los campos de servicios/bienes. Usa siempre la herramienta extraer_factura_gasto.',
        tools: [HERRAMIENTA],
        tool_choice: { type: 'tool', name: 'extraer_factura_gasto' },
        messages: [{ role: 'user', content: [bloque, { type: 'text', text: 'Lee esta factura de gasto y extrae los datos que puedas con confianza.' }] }],
      });
    } catch (err) {
      this.logger.error(`Error llamando a Anthropic para leer factura de gasto: ${(err as Error).message}`);
      throw new BadRequestException('No se pudo leer el archivo. Intenta con una foto más clara o escribe los datos a mano.');
    }

    const uso = respuesta.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'extraer_factura_gasto',
    );
    if (!uso) throw new BadRequestException('No se pudo leer el archivo. Intenta con una foto más clara.');
    return uso.input as DatosFacturaGastoExtraidos;
  }
}
