import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { AgendaService } from '../agenda/agenda.service.js';
import { ClientesService } from '../clientes/clientes.service.js';
import { ExtraccionIdentidadService } from '../clientes/extraccion-identidad.service.js';
import { FacturacionService } from '../facturacion/facturacion.service.js';
import { CobrosService } from '../facturacion/cobros.service.js';
import { calcularTotales } from '../facturacion/item-facturable.js';
import { Expediente } from '../expedientes/expediente.entity.js';
import { formatearRD } from '../common/formato-moneda.js';
import { obtenerJwtSecretObligatorio } from '../common/config/jwt-secret.js';
import {
  TipoEventoAgenda,
  EstadoEventoAgenda,
  TipoCliente,
  ROLES_CON_ACCESO_FACTURACION,
  ROLES_CON_VISIBILIDAD_TOTAL_EXPEDIENTES,
  RolUsuario,
} from '../common/enums/index.js';

const MODELO = 'claude-sonnet-5';
const MAXIMO_VUELTAS_HERRAMIENTAS = 8;
const VIGENCIA_PROPUESTA_MS = 20 * 60 * 1000;

/** Acción que el asistente PREPARA; solo se ejecuta cuando la persona la confirma en pantalla. */
export interface AccionPropuesta {
  token: string;
  tipo: 'crear_cliente' | 'crear_cotizacion' | 'enviar_correo';
  titulo: string;
  lineas: string[];
  /** Texto completo para revisar antes de confirmar (p. ej. el correo). */
  vistaPrevia?: string;
  /** Solo para correos: mensaje de WhatsApp listo para enviar a mano. */
  whatsapp?: { telefono: string; mensaje: string };
}

export interface RespuestaAsistente {
  respuesta: string;
  acciones: AccionPropuesta[];
}

export interface MensajeHistorial {
  rol: 'usuario' | 'asistente';
  texto: string;
}

interface UsuarioAsistente {
  id: string;
  rol: RolUsuario;
}

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
  {
    name: 'preparar_crear_cliente',
    description:
      'PREPARA (no crea todavía) el alta de un cliente nuevo. La persona la confirma con un botón. Úsala cuando pidan registrar/crear un cliente, con los datos de la foto de la cédula o los que diga el usuario. Antes de usarla, busca con buscar_cliente para no duplicar.',
    input_schema: {
      type: 'object',
      properties: {
        tipo: { type: 'string', enum: ['fisico', 'juridico'], description: 'Por defecto "fisico".' },
        nombres: { type: 'string' },
        apellidos: { type: 'string' },
        cedula: { type: 'string', description: 'Formato 000-0000000-0' },
        pasaporte: { type: 'string' },
        rnc: { type: 'string', description: 'Solo personas jurídicas.' },
        razon_social: { type: 'string', description: 'Solo personas jurídicas.' },
        nacionalidad: { type: 'string' },
        fecha_nacimiento: { type: 'string', description: 'YYYY-MM-DD' },
        direccion: { type: 'string' },
        telefono: { type: 'string' },
        correo: { type: 'string' },
        forzar_duplicado: { type: 'boolean', description: 'true solo si el usuario ya confirmó crear pese a un posible duplicado.' },
      },
      required: [],
    },
  },
  {
    name: 'preparar_cotizacion',
    description:
      'PREPARA (no crea todavía) una cotización para un cliente existente. La persona la confirma con un botón. Los montos los da SIEMPRE el usuario: nunca inventes precios; si faltan, pregúntalos.',
    input_schema: {
      type: 'object',
      properties: {
        cliente_id: { type: 'string', description: 'Id obtenido con buscar_cliente.' },
        concepto: { type: 'string', description: 'Descripción corta del servicio, p. ej. "Divorcio por mutuo consentimiento".' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              descripcion: { type: 'string' },
              cantidad: { type: 'number' },
              precio_unitario: { type: 'number', description: 'En RD$, sin ITBIS.' },
            },
            required: ['descripcion', 'cantidad', 'precio_unitario'],
          },
        },
        aplica_itbis: { type: 'boolean', description: 'Por defecto true. Usa false si el usuario dice que no lleva ITBIS.' },
        descuento: { type: 'number', description: 'Monto fijo en RD$. Opcional.' },
        dias_validez: { type: 'number', description: 'Días de vigencia de la cotización. Opcional (por defecto 15).' },
      },
      required: ['cliente_id', 'concepto', 'items'],
    },
  },
  {
    name: 'documentos_del_cliente',
    description:
      'Lista las cotizaciones y facturas más recientes de un cliente (número, estado, total, saldo) y su estado de cuenta. Úsala para responder "cuánto debe", "qué le he cotizado" o para hallar el id de lo que se va a enviar.',
    input_schema: {
      type: 'object',
      properties: { cliente_id: { type: 'string' } },
      required: ['cliente_id'],
    },
  },
  {
    name: 'preparar_envio_correo',
    description:
      'PREPARA (no envía todavía) el correo con el PDF de una cotización, factura o recordatorio de cobro al cliente. La persona revisa el texto y lo confirma con un botón. Obtén el id con documentos_del_cliente.',
    input_schema: {
      type: 'object',
      properties: {
        tipo: { type: 'string', enum: ['cotizacion', 'factura', 'recordatorio'] },
        id: { type: 'string', description: 'Id de la cotización o factura.' },
        para: { type: 'string', description: 'Correo destino. Si no se indica, se usa el del cliente.' },
      },
      required: ['tipo', 'id'],
    },
  },
  {
    name: 'expedientes_del_cliente',
    description: 'Lista los expedientes de un cliente (código, materia, estado, próxima actuación, balance) para responder preguntas sobre su caso.',
    input_schema: {
      type: 'object',
      properties: { cliente_id: { type: 'string' } },
      required: ['cliente_id'],
    },
  },
];

@Injectable()
export class AsistenteService {
  private readonly logger = new Logger(AsistenteService.name);
  /** Propuestas ya ejecutadas (evita doble clic / reenvío); expira sola. */
  private readonly ejecutadas = new Map<string, number>();

  constructor(
    private readonly config: ConfigService,
    private readonly agendaService: AgendaService,
    private readonly clientesService: ClientesService,
    private readonly extraccionIdentidad: ExtraccionIdentidadService,
    private readonly facturacion: FacturacionService,
    private readonly cobros: CobrosService,
    @InjectRepository(Expediente) private readonly expedienteRepo: Repository<Expediente>,
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

  private puedeFacturar(u: UsuarioAsistente): boolean {
    return ROLES_CON_ACCESO_FACTURACION.includes(u.rol);
  }

  // --- Propuestas firmadas: el servidor no guarda estado; la propuesta viaja
  // firmada (HMAC) y solo sirve para el usuario que la pidió, por 20 minutos.

  private firmar(tipo: AccionPropuesta['tipo'], datos: unknown, usuarioId: string): string {
    const cuerpo = Buffer.from(
      JSON.stringify({ n: randomUUID(), tipo, datos, usuarioId, exp: Date.now() + VIGENCIA_PROPUESTA_MS }),
    ).toString('base64url');
    const firma = createHmac('sha256', obtenerJwtSecretObligatorio(this.config)).update(cuerpo).digest('base64url');
    return `${cuerpo}.${firma}`;
  }

  private verificar(token: string, usuarioId: string) {
    const [cuerpo, firma] = (token ?? '').split('.');
    if (!cuerpo || !firma) throw new BadRequestException('Propuesta no válida.');
    const esperada = createHmac('sha256', obtenerJwtSecretObligatorio(this.config)).update(cuerpo).digest('base64url');
    const a = Buffer.from(firma);
    const b = Buffer.from(esperada);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new BadRequestException('Propuesta no válida.');
    const p = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8')) as {
      n: string; tipo: AccionPropuesta['tipo']; datos: any; usuarioId: string; exp: number;
    };
    if (p.usuarioId !== usuarioId) throw new BadRequestException('Esta propuesta es de otra persona.');
    if (Date.now() > p.exp) throw new BadRequestException('La propuesta venció (20 minutos). Pídesela de nuevo al asistente.');
    return p;
  }

  /** Ejecuta una propuesta que la persona confirmó con el botón. */
  async confirmarAccion(token: string, usuario: UsuarioAsistente): Promise<{ mensaje: string; clienteId?: string }> {
    const p = this.verificar(token, usuario.id);
    for (const [k, t] of this.ejecutadas) if (Date.now() - t > 60 * 60 * 1000) this.ejecutadas.delete(k);
    if (this.ejecutadas.has(p.n)) throw new BadRequestException('Esta acción ya se ejecutó.');

    let resultado: { mensaje: string; clienteId?: string };
    switch (p.tipo) {
      case 'crear_cliente': {
        const r = await this.clientesService.crear(p.datos.dto, {
          forzarPeseADuplicado: !!p.datos.forzar,
          usuarioId: usuario.id,
        });
        if (r.duplicados) {
          throw new BadRequestException('Ya existe un cliente con esa cédula, pasaporte, RNC o correo. No se creó otro.');
        }
        resultado = {
          mensaje: `Cliente creado: ${this.nombreCliente(r.cliente!)} (${r.cliente!.codigoCliente}).`,
          clienteId: r.cliente!.id,
        };
        break;
      }
      case 'crear_cotizacion': {
        if (!this.puedeFacturar(usuario)) throw new BadRequestException('Tu rol no puede crear cotizaciones.');
        const cot = await this.facturacion.crearCotizacion(p.datos.dto, usuario.id);
        if ('duplicados' in cot) throw new BadRequestException('No se pudo crear la cotización.');
        resultado = { mensaje: `Cotización ${cot.numero} creada por ${formatearRD(cot.total)}.`, clienteId: cot.clienteId };
        break;
      }
      case 'enviar_correo': {
        if (!this.puedeFacturar(usuario)) throw new BadRequestException('Tu rol no puede enviar documentos de cobro.');
        await this.cobros.enviarCorreo(p.datos.dto, usuario.id);
        resultado = { mensaje: `Correo enviado a ${p.datos.dto.para} con el PDF adjunto.` };
        break;
      }
      default:
        throw new BadRequestException('Tipo de propuesta desconocido.');
    }
    this.ejecutadas.set(p.n, Date.now());
    return resultado;
  }

  private async ejecutarHerramienta(
    nombre: string,
    entrada: any,
    usuario: UsuarioAsistente,
    acciones: AccionPropuesta[],
  ): Promise<unknown> {
    const usuarioId = usuario.id;
    switch (nombre) {
      case 'buscar_cliente': {
        const clientes = await this.clientesService.buscar(entrada.termino);
        return clientes.slice(0, 5).map((c) => ({
          id: c.id,
          nombre: this.nombreCliente(c),
          codigoCliente: c.codigoCliente,
          cedula: c.cedula,
          correo: c.correo,
          telefonos: c.telefonos,
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
      case 'preparar_crear_cliente': {
        const juridico = entrada.tipo === 'juridico';
        const dto: any = {
          tipo: juridico ? TipoCliente.JURIDICO : TipoCliente.FISICO,
          nacionalidad: entrada.nacionalidad || 'Dominicana',
          // Campo obligatorio del sistema: si no se dio, queda marcado para completar.
          direccion: entrada.direccion || 'Pendiente de completar',
          ...(entrada.cedula ? { cedula: String(entrada.cedula).trim() } : {}),
          ...(entrada.pasaporte ? { pasaporte: String(entrada.pasaporte).trim() } : {}),
          ...(entrada.correo ? { correo: String(entrada.correo).trim().toLowerCase() } : {}),
          ...(entrada.telefono ? { telefonos: [String(entrada.telefono).trim()] } : {}),
        };
        if (juridico) {
          if (!entrada.razon_social) return { error: 'Falta la razón social.' };
          dto.razonSocial = entrada.razon_social;
          if (entrada.rnc) dto.rnc = String(entrada.rnc).trim();
        } else {
          if (!entrada.nombres || !entrada.apellidos) return { error: 'Faltan los nombres y/o apellidos.' };
          dto.nombres = entrada.nombres;
          dto.apellidos = entrada.apellidos;
          if (entrada.fecha_nacimiento) dto.fechaNacimiento = entrada.fecha_nacimiento;
        }
        const duplicados = await this.clientesService.detectarDuplicados(dto);
        if (duplicados.length > 0 && !entrada.forzar_duplicado) {
          return {
            error: 'Posible duplicado: ya existe un cliente con el mismo dato.',
            duplicados: duplicados.map((d) => ({
              coincide_en: d.campo,
              id: d.clienteExistente.id,
              nombre: this.nombreCliente(d.clienteExistente),
              codigoCliente: d.clienteExistente.codigoCliente,
            })),
            instruccion: 'Dile al usuario quién es el cliente existente y pregunta si quiere usar ese o crear otro igualmente.',
          };
        }
        const nombre = juridico ? dto.razonSocial : `${dto.nombres} ${dto.apellidos}`;
        const lineas = [
          `Tipo: ${juridico ? 'Persona jurídica' : 'Persona física'}`,
          dto.cedula ? `Cédula: ${dto.cedula}` : null,
          dto.pasaporte ? `Pasaporte: ${dto.pasaporte}` : null,
          dto.rnc ? `RNC: ${dto.rnc}` : null,
          `Nacionalidad: ${dto.nacionalidad}`,
          dto.fechaNacimiento ? `Nacimiento: ${dto.fechaNacimiento}` : null,
          `Dirección: ${dto.direccion}`,
          dto.telefonos ? `Teléfono: ${dto.telefonos[0]}` : null,
          dto.correo ? `Correo: ${dto.correo}` : null,
        ].filter((l): l is string => !!l);
        acciones.push({
          token: this.firmar('crear_cliente', { dto, forzar: !!entrada.forzar_duplicado }, usuarioId),
          tipo: 'crear_cliente',
          titulo: `Crear cliente: ${nombre}`,
          lineas,
        });
        return { ok: true, estado: 'propuesta lista; la persona debe confirmarla con el botón. El cliente AÚN NO existe.' };
      }
      case 'preparar_cotizacion': {
        if (!this.puedeFacturar(usuario)) return { error: 'Tu rol no tiene permiso para cotizar.' };
        const items = (entrada.items ?? []).map((i: any) => ({
          descripcion: String(i.descripcion),
          cantidad: Number(i.cantidad) || 1,
          precioUnitario: Number(i.precio_unitario),
        }));
        if (!items.length || items.some((i: any) => !Number.isFinite(i.precioUnitario) || i.precioUnitario < 0)) {
          return { error: 'Faltan los montos. Pregúntale al usuario cuánto cobrar; no inventes precios.' };
        }
        const cliente = await this.clientesService.obtenerPorId(entrada.cliente_id);
        const aplicaItbis = entrada.aplica_itbis ?? true;
        const descuento = Number(entrada.descuento) || 0;
        const totales = calcularTotales(items, aplicaItbis, descuento);
        const dias = Number(entrada.dias_validez) > 0 ? Number(entrada.dias_validez) : 15;
        const validaHasta = new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10);
        const dto = { clienteId: cliente.id, concepto: String(entrada.concepto), items, aplicaItbis, descuento, validaHasta };
        acciones.push({
          token: this.firmar('crear_cotizacion', { dto }, usuarioId),
          tipo: 'crear_cotizacion',
          titulo: `Cotización para ${this.nombreCliente(cliente)}`,
          lineas: [
            `Concepto: ${dto.concepto}`,
            ...items.map((i: any) => `${i.cantidad} × ${i.descripcion}: ${formatearRD(i.cantidad * i.precioUnitario)}`),
            descuento > 0 ? `Descuento: ${formatearRD(descuento)}` : null,
            aplicaItbis ? `ITBIS (18%): ${formatearRD(totales.itbis)}` : 'Sin ITBIS',
            `TOTAL: ${formatearRD(totales.total)}`,
            `Válida hasta: ${validaHasta}`,
          ].filter((l): l is string => !!l),
        });
        return { ok: true, total: totales.total, estado: 'propuesta lista; la persona debe confirmarla con el botón. La cotización AÚN NO existe.' };
      }
      case 'documentos_del_cliente': {
        if (!this.puedeFacturar(usuario)) return { error: 'Tu rol no tiene acceso a la facturación.' };
        const [cots, estado] = await Promise.all([
          this.facturacion.listarCotizaciones({ clienteId: entrada.cliente_id }),
          this.facturacion.estadoDeCuenta(entrada.cliente_id),
        ]);
        const lista = (Array.isArray(cots) ? cots : cots.datos).slice(0, 8);
        return {
          cliente: estado.cliente.nombre,
          totalFacturado: formatearRD(estado.totalFacturado),
          totalPagado: formatearRD(estado.totalPagado),
          totalPendiente: formatearRD(estado.totalPendiente),
          facturas: estado.facturas.slice(0, 8).map((f) => ({
            id: f.id, numero: f.numero, estado: f.estado, total: formatearRD(f.total), saldo: formatearRD(f.saldoPendiente), vence: f.fechaVencimiento,
          })),
          cotizaciones: lista.map((c) => ({ id: c.id, numero: c.numero, estado: c.estado, total: formatearRD(c.total), concepto: c.concepto })),
        };
      }
      case 'preparar_envio_correo': {
        if (!this.puedeFacturar(usuario)) return { error: 'Tu rol no tiene permiso para enviar documentos de cobro.' };
        const b = await this.cobros.borrador(entrada.tipo, entrada.id);
        const para = String(entrada.para || b.para || '').trim();
        if (!para) {
          return { error: `El cliente ${b.cliente.nombre} no tiene correo registrado. Pregúntale al usuario a qué correo enviarlo.` };
        }
        if (!b.smtpConfigurado) {
          return { error: 'El correo saliente todavía no está configurado en el sistema; no se puede enviar. Puedes ofrecer el mensaje de WhatsApp.' };
        }
        acciones.push({
          token: this.firmar('enviar_correo', { dto: { tipo: entrada.tipo, id: entrada.id, para, asunto: b.asunto, mensaje: b.mensaje } }, usuarioId),
          tipo: 'enviar_correo',
          titulo: `Enviar ${b.numero} a ${b.cliente.nombre}`,
          lineas: [`Para: ${para}`, `Asunto: ${b.asunto}`, `Adjunto: ${b.adjuntoNombre}`],
          vistaPrevia: b.mensaje,
          whatsapp: b.whatsapp.telefono ? { telefono: b.whatsapp.telefono, mensaje: b.whatsapp.mensaje } : undefined,
        });
        return { ok: true, estado: 'correo preparado; la persona lo revisa y debe confirmarlo con el botón. AÚN NO se envió nada.' };
      }
      case 'expedientes_del_cliente': {
        const where: any = { clienteId: entrada.cliente_id };
        if (!ROLES_CON_VISIBILIDAD_TOTAL_EXPEDIENTES.includes(usuario.rol)) where.abogadoResponsableId = usuarioId;
        const lista = await this.expedienteRepo.find({ where, order: { actualizadoEn: 'DESC' }, take: 8 });
        return lista.map((e) => ({
          codigo: e.codigo,
          materia: e.materia,
          estado: e.estado,
          tribunalInstitucion: e.tribunalInstitucion,
          proximaActuacion: e.proximaActuacion,
          fechaLimite: e.fechaLimite,
          balancePendiente: this.puedeFacturar(usuario) ? formatearRD(e.balancePendiente) : undefined,
        }));
      }
      default:
        return { error: `Herramienta desconocida: ${nombre}` };
    }
  }

  async procesarMensaje(
    texto: string,
    usuario: UsuarioAsistente,
    opciones: { fotos?: { buffer: Buffer; mimetype: string }[]; historial?: MensajeHistorial[] } = {},
  ): Promise<RespuestaAsistente> {
    const anthropic = this.cliente();
    const ahora = new Date();
    const acciones: AccionPropuesta[] = [];

    // Si viene una foto, primero se lee con el mismo lector de cédulas/pasaportes
    // del formulario de clientes; el resultado entra al chat como contexto.
    let textoUsuario = texto?.trim() ?? '';
    if (opciones.fotos?.length) {
      const resumenes: string[] = [];
      for (const [i, f] of opciones.fotos.entries()) {
        const datos = await this.extraccionIdentidad.extraerDeArchivo(f.buffer, f.mimetype);
        resumenes.push(
          datos.esDocumentoIdentidad
            ? `[Foto ${i + 1}: datos leídos del documento de identidad: ${JSON.stringify(datos)}. Revisa las advertencias de lectura antes de usarlos.]`
            : `[Foto ${i + 1}: NO parece un documento de identidad legible (${datos.advertencias || 'sin detalle'}). Pídele otra foto más clara si la necesitas.]`,
        );
      }
      const varias = opciones.fotos.length > 1 ? ' Si son frente y dorso del mismo documento, combínalos; si son personas distintas, trátalas por separado.' : '';
      textoUsuario = `${resumenes.join('\n')}${varias}\n${textoUsuario || 'Registra a esta persona como cliente.'}`;
    }
    if (!textoUsuario) throw new BadRequestException('Escribe una instrucción o adjunta una foto.');

    const systemPrompt = `Eres el asistente de JAYM LEGAL MULTISERVICES, un despacho de abogados en La Romana, República Dominicana. Ayudas al personal (desde el teléfono, normalmente) a: consultar y gestionar la agenda, registrar clientes (a partir de la foto de su cédula o pasaporte), preparar cotizaciones, preparar el envío de cotizaciones/facturas por correo y responder consultas sobre clientes, cobros y expedientes. Lo haces en lenguaje natural, en español, con las herramientas disponibles.

Hoy es ${ahora.toLocaleDateString('es-DO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Santo_Domingo' })} (${ahora.toISOString().slice(0, 10)}). Zona horaria: America/Santo_Domingo (UTC-4, sin horario de verano); las fechas/horas que envíes a las herramientas deben incluir ese desfase, ej. "2026-09-04T15:00:00-04:00".

Reglas:
- Si mencionan un cliente por nombre, usa buscar_cliente primero. Si hay varias coincidencias o ninguna, pregunta; no adivines.
- Para crear clientes, cotizaciones y enviar correos solo PREPARAS la acción con las herramientas "preparar_*": la persona la revisa y la confirma con un botón en pantalla. Nunca digas que ya quedó creado o enviado; di que quedó preparado para que lo confirme.
- Los montos y precios los da SIEMPRE el usuario. Nunca inventes ni estimes honorarios. Si faltan, pregunta.
- Con la foto de una cédula: usa solo lo que se leyó con claridad; si hay advertencias o datos dudosos, menciónalos. No inventes dirección, teléfono ni correo: si no los dieron, no los pongas (el sistema marca la dirección como pendiente).
- Si hay un posible duplicado, di quién es el cliente existente y pregunta qué prefiere.
- No reveles notas internas ni estrategias jurídicas de expedientes; solo estado, próxima actuación y datos de cobro.
- Si te piden algo que no puedes hacer con tus herramientas (por ejemplo registrar un pago o emitir una factura electrónica), dilo con claridad y di dónde se hace en el sistema.
- Responde breve, claro y sin tecnicismos: quien te lee no es una persona técnica y probablemente está en el celular. Cierra con una frase de qué quedó hecho o preparado.`;

    const mensajes: Anthropic.MessageParam[] = [];
    for (const m of (opciones.historial ?? []).slice(-8)) {
      if (!m?.texto) continue;
      const rol = m.rol === 'asistente' ? 'assistant' : 'user';
      // La API exige alternar roles: se fusionan los consecutivos del mismo rol.
      const ultimo = mensajes[mensajes.length - 1];
      if (ultimo && ultimo.role === rol && typeof ultimo.content === 'string') ultimo.content += `\n${m.texto}`;
      else mensajes.push({ role: rol, content: m.texto });
    }
    while (mensajes.length && mensajes[0].role !== 'user') mensajes.shift();
    const penultimo = mensajes[mensajes.length - 1];
    if (penultimo && penultimo.role === 'user' && typeof penultimo.content === 'string') {
      penultimo.content += `\n${textoUsuario}`;
    } else {
      mensajes.push({ role: 'user', content: textoUsuario });
    }

    for (let vuelta = 0; vuelta < MAXIMO_VUELTAS_HERRAMIENTAS; vuelta++) {
      const respuesta = await anthropic.messages.create({
        model: MODELO,
        max_tokens: 1500,
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
        return { respuesta: textoFinal || 'Listo.', acciones };
      }

      mensajes.push({ role: 'assistant', content: respuesta.content });

      const resultados: Anthropic.ToolResultBlockParam[] = [];
      for (const bloque of bloquesHerramienta) {
        try {
          const resultado = await this.ejecutarHerramienta(bloque.name, bloque.input, usuario, acciones);
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

    return { respuesta: 'No pude terminar esa solicitud — intenta describirla en pasos más simples.', acciones };
  }
}
