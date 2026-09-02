import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { AgendaService } from '../agenda/agenda.service.js';
import { ClientesService } from '../clientes/clientes.service.js';
import { TipoEventoAgenda, EstadoEventoAgenda, TipoCliente } from '../common/enums/index.js';

const MODELO = 'claude-sonnet-5';
const MAXIMO_VUELTAS_HERRAMIENTAS = 6;

const HERRAMIENTAS: Anthropic.Tool[] = [
  {
    name: 'buscar_cliente',
    description:
      'Busca clientes de JAYM LEGAL por nombre, apellido, razón social, cédula, pasaporte, RNC o correo. Úsala SIEMPRE que el usuario mencione un cliente por nombre, antes de crear o modificar un evento relacionado con él.',
    input_schema: {
      type: 'object',
      properties: {
        termino: { type: 'string', description: 'Nombre u otro dato del cliente a buscar' },
      },
      required: ['termino'],
    },
  },
  {
    name: 'consultar_disponibilidad',
    description: 'Lista los eventos de la agenda ya existentes entre dos fechas, para ver qué hay ocupado.',
    input_schema: {
      type: 'object',
      properties: {
        fecha_inicio: { type: 'string', description: 'Fecha/hora ISO-8601 con desfase horario, ej. 2026-09-04T00:00:00-04:00' },
        fecha_fin: { type: 'string', description: 'Fecha/hora ISO-8601 con desfase horario' },
      },
      required: ['fecha_inicio', 'fecha_fin'],
    },
  },
  {
    name: 'listar_proximos_eventos',
    description: 'Lista los próximos eventos de la agenda a partir de ahora, para responder preguntas como "qué tengo esta semana".',
    input_schema: {
      type: 'object',
      properties: {
        dias: { type: 'number', description: 'Cuántos días hacia adelante mirar (por ejemplo 7 para "esta semana")' },
      },
      required: ['dias'],
    },
  },
  {
    name: 'crear_evento',
    description: 'Crea un nuevo evento en la agenda de JAYM LEGAL (y en Google Calendar si está conectado).',
    input_schema: {
      type: 'object',
      properties: {
        titulo: { type: 'string' },
        tipo: {
          type: 'string',
          enum: Object.values(TipoEventoAgenda),
          description: 'Tipo de evento; si no se sabe, usar "cita".',
        },
        fecha_hora_inicio: { type: 'string', description: 'ISO-8601 con desfase horario, ej. 2026-09-04T15:00:00-04:00' },
        fecha_hora_fin: { type: 'string', description: 'ISO-8601 con desfase horario. Opcional.' },
        cliente_id: { type: 'string', description: 'Id del cliente (obtenido con buscar_cliente), si aplica.' },
        descripcion: { type: 'string', description: 'Notas u observaciones del evento.' },
      },
      required: ['titulo', 'fecha_hora_inicio'],
    },
  },
  {
    name: 'modificar_evento',
    description: 'Modifica un evento existente de la agenda (cambiar título, fecha/hora o descripción).',
    input_schema: {
      type: 'object',
      properties: {
        id_evento: { type: 'string' },
        titulo: { type: 'string' },
        fecha_hora_inicio: { type: 'string', description: 'ISO-8601 con desfase horario' },
        fecha_hora_fin: { type: 'string', description: 'ISO-8601 con desfase horario' },
        descripcion: { type: 'string' },
      },
      required: ['id_evento'],
    },
  },
  {
    name: 'cancelar_evento',
    description: 'Cancela (no elimina) un evento existente de la agenda.',
    input_schema: {
      type: 'object',
      properties: {
        id_evento: { type: 'string' },
      },
      required: ['id_evento'],
    },
  },
];

@Injectable()
export class AsistenteService {
  private readonly logger = new Logger(AsistenteService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly agendaService: AgendaService,
    private readonly clientesService: ClientesService,
  ) {}

  private cliente(): Anthropic {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new BadRequestException(
        'El asistente todavía no está activado: falta configurar la clave de Anthropic (ANTHROPIC_API_KEY) en el archivo .env del backend.',
      );
    }
    return new Anthropic({ apiKey });
  }

  private nombreCliente(c: { tipo: TipoCliente; nombres?: string; apellidos?: string; razonSocial?: string }): string {
    return c.tipo === TipoCliente.JURIDICO ? (c.razonSocial ?? '') : `${c.nombres ?? ''} ${c.apellidos ?? ''}`.trim();
  }

  private async ejecutarHerramienta(nombre: string, entrada: any, usuarioId: string): Promise<unknown> {
    switch (nombre) {
      case 'buscar_cliente': {
        const clientes = await this.clientesService.buscar(entrada.termino);
        return clientes.slice(0, 5).map((c) => ({
          id: c.id,
          nombre: this.nombreCliente(c),
          codigoCliente: c.codigoCliente,
        }));
      }
      case 'consultar_disponibilidad':
      case 'listar_proximos_eventos': {
        const desde = nombre === 'consultar_disponibilidad' ? new Date(entrada.fecha_inicio) : new Date();
        const hasta =
          nombre === 'consultar_disponibilidad'
            ? new Date(entrada.fecha_fin)
            : new Date(Date.now() + Number(entrada.dias ?? 7) * 24 * 60 * 60 * 1000);
        const eventos = await this.agendaService.listar({ desde: desde.toISOString(), hasta: hasta.toISOString() });
        return eventos.map((e) => ({
          id: e.id,
          titulo: e.titulo,
          tipo: e.tipo,
          estado: e.estado,
          inicio: e.fechaHoraInicio,
          fin: e.fechaHoraFin,
        }));
      }
      case 'crear_evento': {
        const evento = await this.agendaService.crear(
          {
            tipo: (entrada.tipo as TipoEventoAgenda) ?? TipoEventoAgenda.CITA,
            titulo: entrada.titulo,
            fechaHoraInicio: entrada.fecha_hora_inicio,
            fechaHoraFin: entrada.fecha_hora_fin,
            clienteId: entrada.cliente_id,
            observaciones: entrada.descripcion,
          },
          usuarioId,
        );
        return { id: evento.id, titulo: evento.titulo, inicio: evento.fechaHoraInicio };
      }
      case 'modificar_evento': {
        const evento = await this.agendaService.actualizar(entrada.id_evento, {
          titulo: entrada.titulo,
          fechaHoraInicio: entrada.fecha_hora_inicio,
          fechaHoraFin: entrada.fecha_hora_fin,
          observaciones: entrada.descripcion,
        });
        return { id: evento.id, titulo: evento.titulo, inicio: evento.fechaHoraInicio };
      }
      case 'cancelar_evento': {
        const evento = await this.agendaService.actualizar(entrada.id_evento, {
          estado: EstadoEventoAgenda.CANCELADO,
        });
        return { id: evento.id, estado: evento.estado };
      }
      default:
        return { error: `Herramienta desconocida: ${nombre}` };
    }
  }

  async procesarMensaje(texto: string, usuarioId: string): Promise<string> {
    const anthropic = this.cliente();
    const ahora = new Date();

    const systemPrompt = `Eres el asistente de agenda de JAYM LEGAL MULTISERVICES, un despacho de abogados en La Romana, República Dominicana. Ayudas al personal del despacho a consultar y gestionar la agenda (citas, audiencias, reuniones, plazos) por lenguaje natural en español, usando las herramientas disponibles.

Hoy es ${ahora.toLocaleDateString('es-DO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} (${ahora.toISOString().slice(0, 10)}). La zona horaria del despacho es America/Santo_Domingo (UTC-4 todo el año, sin horario de verano) — todas las fechas/horas que envíes a las herramientas deben incluir ese desfase, ej. "2026-09-04T15:00:00-04:00".

Reglas:
- Si el usuario menciona un cliente por nombre, usa buscar_cliente primero. Si hay varias coincidencias o ninguna, pregunta para aclarar en vez de adivinar.
- Si no te dan hora de fin de un evento, no la envíes; el sistema le pone una por defecto.
- Antes de modificar o cancelar un evento del que no tengas el id, búscalo primero con listar_proximos_eventos o consultar_disponibilidad.
- Responde siempre en español, breve y sin tecnicismos — quien te lee no es una persona técnica.
- Al terminar, confirma en una frase qué quedó hecho o qué encontraste.`;

    const mensajes: Anthropic.MessageParam[] = [{ role: 'user', content: texto }];

    for (let vuelta = 0; vuelta < MAXIMO_VUELTAS_HERRAMIENTAS; vuelta++) {
      const respuesta = await anthropic.messages.create({
        model: MODELO,
        max_tokens: 1024,
        system: systemPrompt,
        tools: HERRAMIENTAS,
        messages: mensajes,
      });

      const bloquesHerramienta = respuesta.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      );

      if (bloquesHerramienta.length === 0) {
        const textoFinal = respuesta.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('\n')
          .trim();
        return textoFinal || 'Listo.';
      }

      mensajes.push({ role: 'assistant', content: respuesta.content });

      const resultados: Anthropic.ToolResultBlockParam[] = [];
      for (const bloque of bloquesHerramienta) {
        try {
          const resultado = await this.ejecutarHerramienta(bloque.name, bloque.input, usuarioId);
          resultados.push({
            type: 'tool_result',
            tool_use_id: bloque.id,
            content: JSON.stringify(resultado),
          });
        } catch (err) {
          this.logger.warn(`Error ejecutando herramienta ${bloque.name}: ${(err as Error).message}`);
          resultados.push({
            type: 'tool_result',
            tool_use_id: bloque.id,
            content: JSON.stringify({ error: (err as Error).message }),
            is_error: true,
          });
        }
      }
      mensajes.push({ role: 'user', content: resultados });
    }

    return 'No pude terminar esa solicitud — intenta describirla en pasos más simples.';
  }
}
