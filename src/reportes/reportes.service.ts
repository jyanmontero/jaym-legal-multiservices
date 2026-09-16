import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Expediente } from '../expedientes/expediente.entity.js';
import { Cliente } from '../clientes/cliente.entity.js';
import { Factura } from '../facturacion/factura.entity.js';
import { Pago } from '../facturacion/pago.entity.js';
import { AgendaEvento } from '../agenda/agenda-evento.entity.js';
import { HistorialExpediente } from '../historial/historial-expediente.entity.js';
import { SeguimientoExpediente } from '../seguimiento/seguimiento-expediente.entity.js';
import { HistorialCambio } from '../historial-cambios/historial-cambio.entity.js';
import { Usuario } from '../usuarios/usuario.entity.js';
import { Documento } from '../documentos/documento.entity.js';
import { ExpedienteRequisitosService } from '../requisitos/expediente-requisitos.service.js';
import { GastosService } from '../facturacion/gastos.service.js';
import { TipoCliente, EstadoExpediente, EstadoFactura, TipoEventoAgenda, EstadoEventoAgenda } from '../common/enums/index.js';
import type { DatosReporte } from './reportes-exportar.util.js';

const ESTADOS_CERRADOS = [
  EstadoExpediente.CERRADO_FAVORABLE,
  EstadoExpediente.CERRADO_DESFAVORABLE,
  EstadoExpediente.ARCHIVADO,
];

function nombreCliente(cliente?: Cliente | null): string {
  if (!cliente) return '—';
  if (cliente.tipo === TipoCliente.JURIDICO) return cliente.razonSocial ?? cliente.nombreComercial ?? '—';
  return [cliente.nombres, cliente.apellidos].filter(Boolean).join(' ') || '—';
}

function formatoRD(valor: number | string): string {
  const n = typeof valor === 'string' ? Number(valor) : valor;
  return `RD$ ${n.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatoFecha(valor?: string | Date | null): string {
  if (!valor) return '—';
  const d = typeof valor === 'string' ? new Date(valor) : valor;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-DO');
}

@Injectable()
export class ReportesService {
  constructor(
    @InjectRepository(Expediente) private readonly expedienteRepo: Repository<Expediente>,
    @InjectRepository(Cliente) private readonly clienteRepo: Repository<Cliente>,
    @InjectRepository(Factura) private readonly facturaRepo: Repository<Factura>,
    @InjectRepository(Pago) private readonly pagoRepo: Repository<Pago>,
    @InjectRepository(AgendaEvento) private readonly agendaRepo: Repository<AgendaEvento>,
    @InjectRepository(HistorialExpediente) private readonly historialExpedienteRepo: Repository<HistorialExpediente>,
    @InjectRepository(SeguimientoExpediente) private readonly seguimientoRepo: Repository<SeguimientoExpediente>,
    @InjectRepository(HistorialCambio) private readonly historialCambioRepo: Repository<HistorialCambio>,
    @InjectRepository(Usuario) private readonly usuarioRepo: Repository<Usuario>,
    @InjectRepository(Documento) private readonly documentoRepo: Repository<Documento>,
    private readonly requisitosService: ExpedienteRequisitosService,
    private readonly gastosService: GastosService,
  ) {}

  /** Catálogo de reportes disponibles -- para que el frontend arme los botones sin repetir esta lista. */
  catalogo() {
    return [
      { clave: 'expedientes-activos', nombre: 'Expedientes activos' },
      { clave: 'expedientes-por-estado', nombre: 'Expedientes por estado' },
      { clave: 'expedientes-por-institucion', nombre: 'Expedientes por institución' },
      { clave: 'expedientes-incompletos', nombre: 'Expedientes incompletos' },
      { clave: 'expedientes-sin-seguimiento', nombre: 'Expedientes sin seguimiento' },
      { clave: 'audiencias-vencimientos', nombre: 'Audiencias y vencimientos', admiteRangoFecha: true },
      { clave: 'productividad-abogados', nombre: 'Productividad por abogado' },
      { clave: 'facturacion', nombre: 'Facturación', admiteRangoFecha: true },
      { clave: 'pagos', nombre: 'Pagos', admiteRangoFecha: true },
      { clave: 'cuentas-por-cobrar', nombre: 'Cuentas por cobrar' },
      { clave: 'gastos-por-expediente', nombre: 'Gastos por expediente', admiteRangoFecha: true },
      { clave: 'rentabilidad-por-servicio', nombre: 'Rentabilidad por servicio', admiteRangoFecha: true },
      { clave: 'historial-modificaciones', nombre: 'Historial de modificaciones', admiteRangoFecha: true },
      { clave: 'actividad-usuarios', nombre: 'Actividad de usuarios' },
    ];
  }

  private async clientesPorId(ids: string[]): Promise<Map<string, Cliente>> {
    if (ids.length === 0) return new Map();
    const clientes = await this.clienteRepo.findBy({ id: In([...new Set(ids)]) });
    return new Map(clientes.map((c) => [c.id, c]));
  }

  private async usuariosPorId(ids: (string | undefined | null)[]): Promise<Map<string, Usuario>> {
    const limpios = [...new Set(ids.filter((i): i is string => Boolean(i)))];
    if (limpios.length === 0) return new Map();
    const usuarios = await this.usuarioRepo.findBy({ id: In(limpios) });
    return new Map(usuarios.map((u) => [u.id, u]));
  }

  async expedientesActivos(): Promise<DatosReporte> {
    const expedientes = await this.expedienteRepo.find({ order: { actualizadoEn: 'DESC' } });
    const activos = expedientes.filter((e) => !ESTADOS_CERRADOS.includes(e.estado));
    const clientes = await this.clientesPorId(activos.map((e) => e.clienteId));
    const abogados = await this.usuariosPorId(activos.map((e) => e.abogadoResponsableId));

    return {
      titulo: 'Expedientes activos',
      subtitulo: `${activos.length} de ${expedientes.length} expedientes totales`,
      columnas: [
        { header: 'Código', key: 'codigo', width: 20 },
        { header: 'Cliente', key: 'cliente', width: 26 },
        { header: 'Materia', key: 'materia', width: 16 },
        { header: 'Estado', key: 'estado', width: 22 },
        { header: 'Abogado', key: 'abogado', width: 22 },
        { header: 'Próxima actuación', key: 'proximaActuacion', width: 16 },
        { header: 'Fecha límite', key: 'fechaLimite', width: 14 },
      ],
      filas: activos.map((e) => ({
        codigo: e.codigo,
        cliente: nombreCliente(clientes.get(e.clienteId)),
        materia: e.materia.replace(/_/g, ' '),
        estado: e.estado.replace(/_/g, ' '),
        abogado: abogados.get(e.abogadoResponsableId ?? '')?.nombreCompleto ?? 'Sin asignar',
        proximaActuacion: formatoFecha(e.proximaActuacion),
        fechaLimite: formatoFecha(e.fechaLimite),
      })),
    };
  }

  async expedientesPorEstado(): Promise<DatosReporte> {
    const expedientes = await this.expedienteRepo.find();
    const grupos = new Map<string, number>();
    for (const e of expedientes) grupos.set(e.estado, (grupos.get(e.estado) ?? 0) + 1);

    return {
      titulo: 'Expedientes por estado',
      subtitulo: `${expedientes.length} expedientes totales`,
      columnas: [
        { header: 'Estado', key: 'estado', width: 26 },
        { header: 'Cantidad', key: 'cantidad', width: 14 },
        { header: '% del total', key: 'porcentaje', width: 14 },
      ],
      filas: [...grupos.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([estado, cantidad]) => ({
          estado: estado.replace(/_/g, ' '),
          cantidad,
          porcentaje: `${expedientes.length ? Math.round((cantidad / expedientes.length) * 100) : 0}%`,
        })),
    };
  }

  async expedientesPorInstitucion(): Promise<DatosReporte> {
    const expedientes = await this.expedienteRepo.find();
    const grupos = new Map<string, number>();
    for (const e of expedientes) {
      const clave = e.tribunalInstitucion?.trim() || 'Sin institución registrada';
      grupos.set(clave, (grupos.get(clave) ?? 0) + 1);
    }

    return {
      titulo: 'Expedientes por institución',
      columnas: [
        { header: 'Institución', key: 'institucion', width: 34 },
        { header: 'Cantidad de expedientes', key: 'cantidad', width: 18 },
      ],
      filas: [...grupos.entries()].sort((a, b) => b[1] - a[1]).map(([institucion, cantidad]) => ({ institucion, cantidad })),
    };
  }

  async expedientesIncompletos(): Promise<DatosReporte> {
    const expedientes = await this.expedienteRepo.find({
      where: {},
      order: { actualizadoEn: 'DESC' },
    });
    const activos = expedientes.filter((e) => !ESTADOS_CERRADOS.includes(e.estado));
    const clientes = await this.clientesPorId(activos.map((e) => e.clienteId));

    const filas: Record<string, any>[] = [];
    for (const e of activos) {
      const progreso = await this.requisitosService.calcularProgreso(e.id);
      if (progreso.porcentaje >= 100) continue;
      filas.push({
        codigo: e.codigo,
        cliente: nombreCliente(clientes.get(e.clienteId)),
        estado: e.estado.replace(/_/g, ' '),
        porcentaje: `${progreso.porcentaje}%`,
        pendientes: progreso.pendientesObligatorios.map((r) => r.nombreRequisito).join(', ') || '—',
      });
    }
    filas.sort((a, b) => parseInt(a.porcentaje) - parseInt(b.porcentaje));

    return {
      titulo: 'Expedientes incompletos',
      subtitulo: `${filas.length} de ${activos.length} expedientes activos con requisitos obligatorios pendientes`,
      columnas: [
        { header: 'Código', key: 'codigo', width: 20 },
        { header: 'Cliente', key: 'cliente', width: 26 },
        { header: 'Estado', key: 'estado', width: 20 },
        { header: '% completado', key: 'porcentaje', width: 14 },
        { header: 'Requisitos pendientes', key: 'pendientes', width: 45 },
      ],
      filas,
    };
  }

  async expedientesSinSeguimiento(diasSinMovimiento = 30): Promise<DatosReporte> {
    const expedientes = await this.expedienteRepo.find();
    const activos = expedientes.filter((e) => !ESTADOS_CERRADOS.includes(e.estado));
    const limite = new Date();
    limite.setDate(limite.getDate() - diasSinMovimiento);

    const ultimos = await this.seguimientoRepo
      .createQueryBuilder('s')
      .select('s.expedienteId', 'expedienteId')
      .addSelect('MAX(s.creadoEn)', 'ultimo')
      .groupBy('s.expedienteId')
      .getRawMany<{ expedienteId: string; ultimo: Date }>();
    const ultimoPorExpediente = new Map(ultimos.map((u) => [u.expedienteId, new Date(u.ultimo)]));

    const sinSeguimiento = activos.filter((e) => {
      const ultimo = ultimoPorExpediente.get(e.id);
      return !ultimo || ultimo < limite;
    });
    const clientes = await this.clientesPorId(sinSeguimiento.map((e) => e.clienteId));

    return {
      titulo: 'Expedientes sin seguimiento reciente',
      subtitulo: `Sin una nota de seguimiento en los últimos ${diasSinMovimiento} días`,
      columnas: [
        { header: 'Código', key: 'codigo', width: 20 },
        { header: 'Cliente', key: 'cliente', width: 26 },
        { header: 'Estado', key: 'estado', width: 20 },
        { header: 'Última nota de seguimiento', key: 'ultimaNota', width: 20 },
      ],
      filas: sinSeguimiento.map((e) => {
        const ultimo = ultimoPorExpediente.get(e.id) ?? null;
        return {
          codigo: e.codigo,
          cliente: nombreCliente(clientes.get(e.clienteId)),
          estado: e.estado.replace(/_/g, ' '),
          ultimaNota: ultimo ? formatoFecha(ultimo) : 'Nunca',
        };
      }),
    };
  }

  async audienciasYVencimientos(desde?: string, hasta?: string): Promise<DatosReporte> {
    const qb = this.agendaRepo
      .createQueryBuilder('e')
      .where('e.tipo IN (:...tipos)', { tipos: [TipoEventoAgenda.AUDIENCIA, TipoEventoAgenda.PLAZO_JUDICIAL, TipoEventoAgenda.VENCIMIENTO] })
      .andWhere('e.estado NOT IN (:...excluidos)', { excluidos: [EstadoEventoAgenda.CANCELADO] });
    if (desde) qb.andWhere('e.fechaHoraInicio >= :desde', { desde });
    if (hasta) qb.andWhere('e.fechaHoraInicio <= :hasta', { hasta });
    const eventos = await qb.orderBy('e.fechaHoraInicio', 'ASC').getMany();

    const codigosExpediente = new Map<string, string>();
    const idsExpediente = [...new Set(eventos.map((e) => e.expedienteId).filter((i): i is string => Boolean(i)))];
    if (idsExpediente.length) {
      const expedientes = await this.expedienteRepo.findBy({ id: In(idsExpediente) });
      for (const exp of expedientes) codigosExpediente.set(exp.id, exp.codigo);
    }

    const ahora = new Date();
    return {
      titulo: 'Audiencias y vencimientos',
      subtitulo: desde || hasta ? `Del ${desde ?? '—'} al ${hasta ?? '—'}` : 'Todos los registrados',
      columnas: [
        { header: 'Tipo', key: 'tipo', width: 16 },
        { header: 'Título', key: 'titulo', width: 28 },
        { header: 'Expediente', key: 'expediente', width: 18 },
        { header: 'Fecha y hora', key: 'fecha', width: 20 },
        { header: 'Estado', key: 'estado', width: 16 },
        { header: 'Situación', key: 'situacion', width: 14 },
      ],
      filas: eventos.map((e) => ({
        tipo: e.tipo.replace(/_/g, ' '),
        titulo: e.titulo,
        expediente: e.expedienteId ? (codigosExpediente.get(e.expedienteId) ?? '—') : '—',
        fecha: new Date(e.fechaHoraInicio).toLocaleString('es-DO', { dateStyle: 'medium', timeStyle: 'short' }),
        estado: e.estado.replace(/_/g, ' '),
        situacion:
          e.estado === EstadoEventoAgenda.COMPLETADO
            ? 'Completado'
            : new Date(e.fechaHoraInicio) < ahora
              ? 'Vencido'
              : 'Próximo',
      })),
    };
  }

  async productividadPorAbogado(): Promise<DatosReporte> {
    const [expedientes, facturas, usuarios] = await Promise.all([
      this.expedienteRepo.find(),
      this.facturaRepo.find(),
      this.usuarioRepo.find(),
    ]);

    const facturacionPorExpediente = new Map<string, number>();
    for (const f of facturas) {
      if (!f.expedienteId) continue;
      facturacionPorExpediente.set(f.expedienteId, (facturacionPorExpediente.get(f.expedienteId) ?? 0) + Number(f.total));
    }

    const filas = usuarios.map((u) => {
      const propios = expedientes.filter((e) => e.abogadoResponsableId === u.id);
      const activos = propios.filter((e) => !ESTADOS_CERRADOS.includes(e.estado));
      const cerrados = propios.filter((e) => ESTADOS_CERRADOS.includes(e.estado));
      const facturado = propios.reduce((acc, e) => acc + (facturacionPorExpediente.get(e.id) ?? 0), 0);
      return {
        abogado: u.nombreCompleto,
        rol: u.rol.replace(/_/g, ' '),
        expedientesTotal: propios.length,
        expedientesActivos: activos.length,
        expedientesCerrados: cerrados.length,
        facturado: formatoRD(facturado),
      };
    });
    const sinAsignar = expedientes.filter((e) => !e.abogadoResponsableId).length;

    filas.sort((a, b) => b.expedientesTotal - a.expedientesTotal);

    return {
      titulo: 'Productividad por abogado',
      subtitulo: sinAsignar > 0 ? `${sinAsignar} expediente(s) sin abogado asignado` : undefined,
      columnas: [
        { header: 'Abogado', key: 'abogado', width: 24 },
        { header: 'Rol', key: 'rol', width: 20 },
        { header: 'Expedientes totales', key: 'expedientesTotal', width: 16 },
        { header: 'Activos', key: 'expedientesActivos', width: 12 },
        { header: 'Cerrados', key: 'expedientesCerrados', width: 12 },
        { header: 'Facturado (de sus casos)', key: 'facturado', width: 20 },
      ],
      filas,
    };
  }

  async facturacion(desde?: string, hasta?: string): Promise<DatosReporte> {
    const qb = this.facturaRepo.createQueryBuilder('f');
    if (desde) qb.andWhere('f.fechaEmision >= :desde', { desde });
    if (hasta) qb.andWhere('f.fechaEmision <= :hasta', { hasta });
    const facturas = await qb.orderBy('f.fechaEmision', 'DESC').getMany();
    const clientes = await this.clientesPorId(facturas.map((f) => f.clienteId));

    const total = facturas.reduce((acc, f) => acc + Number(f.total), 0);
    const cobrado = facturas.reduce((acc, f) => acc + Number(f.montoPagado), 0);

    return {
      titulo: 'Facturación',
      subtitulo: desde || hasta ? `Del ${desde ?? '—'} al ${hasta ?? '—'}` : 'Todo el historial',
      columnas: [
        { header: 'Número', key: 'numero', width: 16 },
        { header: 'Cliente', key: 'cliente', width: 26 },
        { header: 'Fecha', key: 'fecha', width: 14 },
        { header: 'Total', key: 'total', width: 16 },
        { header: 'Pagado', key: 'pagado', width: 16 },
        { header: 'Estado', key: 'estado', width: 16 },
      ],
      filas: facturas.map((f) => ({
        numero: f.numero,
        cliente: nombreCliente(clientes.get(f.clienteId)),
        fecha: formatoFecha(f.fechaEmision),
        total: formatoRD(f.total),
        pagado: formatoRD(f.montoPagado),
        estado: f.estado.replace(/_/g, ' '),
      })),
      resumen: [
        { etiqueta: 'Total facturado', valor: formatoRD(total) },
        { etiqueta: 'Total cobrado', valor: formatoRD(cobrado) },
        { etiqueta: 'Balance pendiente', valor: formatoRD(total - cobrado) },
      ],
    };
  }

  async pagos(desde?: string, hasta?: string): Promise<DatosReporte> {
    const qb = this.pagoRepo.createQueryBuilder('p').leftJoinAndSelect('p.factura', 'factura');
    if (desde) qb.andWhere('p.fecha >= :desde', { desde });
    if (hasta) qb.andWhere('p.fecha <= :hasta', { hasta });
    const pagos = await qb.orderBy('p.fecha', 'DESC').getMany();
    const clientes = await this.clientesPorId(pagos.map((p) => p.factura?.clienteId).filter((i): i is string => Boolean(i)));

    const total = pagos.reduce((acc, p) => acc + Number(p.monto), 0);
    const porMetodo = new Map<string, number>();
    for (const p of pagos) porMetodo.set(p.metodo, (porMetodo.get(p.metodo) ?? 0) + Number(p.monto));

    return {
      titulo: 'Pagos recibidos',
      subtitulo: desde || hasta ? `Del ${desde ?? '—'} al ${hasta ?? '—'}` : 'Todo el historial',
      columnas: [
        { header: 'Fecha', key: 'fecha', width: 14 },
        { header: 'Factura', key: 'factura', width: 16 },
        { header: 'Cliente', key: 'cliente', width: 26 },
        { header: 'Monto', key: 'monto', width: 16 },
        { header: 'Método', key: 'metodo', width: 16 },
        { header: 'Referencia', key: 'referencia', width: 18 },
      ],
      filas: pagos.map((p) => ({
        fecha: formatoFecha(p.fecha),
        factura: p.factura?.numero ?? '—',
        cliente: nombreCliente(clientes.get(p.factura?.clienteId ?? '')),
        monto: formatoRD(p.monto),
        metodo: p.metodo.replace(/_/g, ' '),
        referencia: p.referencia ?? '—',
      })),
      resumen: [
        { etiqueta: 'Total recibido', valor: formatoRD(total) },
        ...[...porMetodo.entries()].map(([metodo, monto]) => ({ etiqueta: `  vía ${metodo}`, valor: formatoRD(monto) })),
      ],
    };
  }

  async cuentasPorCobrar(): Promise<DatosReporte> {
    const facturas = await this.facturaRepo.find({
      where: [{ estado: EstadoFactura.PENDIENTE }, { estado: EstadoFactura.PAGADA_PARCIAL }],
      order: { fechaVencimiento: 'ASC' },
    });
    const clientes = await this.clientesPorId(facturas.map((f) => f.clienteId));
    const hoy = new Date().toISOString().slice(0, 10);

    const filas = facturas.map((f) => {
      const balance = Number(f.total) - Number(f.montoPagado);
      const vencida = f.fechaVencimiento ? f.fechaVencimiento < hoy : false;
      return {
        numero: f.numero,
        cliente: nombreCliente(clientes.get(f.clienteId)),
        total: formatoRD(f.total),
        pagado: formatoRD(f.montoPagado),
        balance: formatoRD(balance),
        vencimiento: formatoFecha(f.fechaVencimiento),
        situacion: vencida ? 'Vencida' : 'Al día',
        _balance: balance,
      };
    });
    const totalBalance = filas.reduce((acc, f) => acc + f._balance, 0);
    const totalVencido = filas.filter((f) => f.situacion === 'Vencida').reduce((acc, f) => acc + f._balance, 0);

    return {
      titulo: 'Cuentas por cobrar',
      subtitulo: `${filas.length} factura(s) con balance pendiente`,
      columnas: [
        { header: 'Número', key: 'numero', width: 16 },
        { header: 'Cliente', key: 'cliente', width: 26 },
        { header: 'Total', key: 'total', width: 16 },
        { header: 'Pagado', key: 'pagado', width: 16 },
        { header: 'Balance', key: 'balance', width: 16 },
        { header: 'Vencimiento', key: 'vencimiento', width: 14 },
        { header: 'Situación', key: 'situacion', width: 14 },
      ],
      filas,
      resumen: [
        { etiqueta: 'Total por cobrar', valor: formatoRD(totalBalance) },
        { etiqueta: 'Total vencido', valor: formatoRD(totalVencido) },
      ],
    };
  }

  async gastosPorExpediente(desde?: string, hasta?: string): Promise<DatosReporte> {
    const totales = await this.gastosService.totalesPorExpediente(desde, hasta);
    const idsExpediente = [...totales.keys()];
    const expedientes = idsExpediente.length ? await this.expedienteRepo.findBy({ id: In(idsExpediente) }) : [];
    const expedientePorId = new Map(expedientes.map((e) => [e.id, e]));
    const clientes = await this.clientesPorId(expedientes.map((e) => e.clienteId));

    const filas = [...totales.entries()].map(([expedienteId, total]) => {
      const exp = expedientePorId.get(expedienteId);
      return {
        codigo: exp?.codigo ?? expedienteId,
        cliente: nombreCliente(clientes.get(exp?.clienteId ?? '')),
        totalGastos: formatoRD(total),
        _total: total,
      };
    });
    filas.sort((a, b) => b._total - a._total);
    const granTotal = filas.reduce((acc, f) => acc + f._total, 0);

    return {
      titulo: 'Gastos por expediente',
      subtitulo: desde || hasta ? `Del ${desde ?? '—'} al ${hasta ?? '—'}` : 'Todo el historial',
      columnas: [
        { header: 'Expediente', key: 'codigo', width: 20 },
        { header: 'Cliente', key: 'cliente', width: 26 },
        { header: 'Total de gastos', key: 'totalGastos', width: 18 },
      ],
      filas,
      resumen: [{ etiqueta: 'Total general', valor: formatoRD(granTotal) }],
    };
  }

  async rentabilidadPorServicio(desde?: string, hasta?: string): Promise<DatosReporte> {
    const qbFacturas = this.facturaRepo.createQueryBuilder('f');
    if (desde) qbFacturas.andWhere('f.fechaEmision >= :desde', { desde });
    if (hasta) qbFacturas.andWhere('f.fechaEmision <= :hasta', { hasta });
    const facturas = await qbFacturas.getMany();

    const idsExpediente = [...new Set(facturas.map((f) => f.expedienteId).filter((i): i is string => Boolean(i)))];
    const expedientes = idsExpediente.length ? await this.expedienteRepo.findBy({ id: In(idsExpediente) }) : [];
    const servicioPorExpediente = new Map(expedientes.map((e) => [e.id, e.tipoServicio?.trim() || e.materia.replace(/_/g, ' ')]));
    const gastosPorExpediente = await this.gastosService.totalesPorExpediente(desde, hasta);

    const ingresoPorServicio = new Map<string, number>();
    for (const f of facturas) {
      const servicio = f.expedienteId ? (servicioPorExpediente.get(f.expedienteId) ?? 'Sin expediente vinculado') : 'Sin expediente vinculado';
      ingresoPorServicio.set(servicio, (ingresoPorServicio.get(servicio) ?? 0) + Number(f.total));
    }
    const gastoPorServicio = new Map<string, number>();
    for (const [expedienteId, gasto] of gastosPorExpediente.entries()) {
      const servicio = servicioPorExpediente.get(expedienteId) ?? 'Sin expediente vinculado';
      gastoPorServicio.set(servicio, (gastoPorServicio.get(servicio) ?? 0) + gasto);
    }

    const servicios = new Set([...ingresoPorServicio.keys(), ...gastoPorServicio.keys()]);
    const filas = [...servicios].map((servicio) => {
      const ingresos = ingresoPorServicio.get(servicio) ?? 0;
      const gastos = gastoPorServicio.get(servicio) ?? 0;
      return {
        servicio,
        ingresos: formatoRD(ingresos),
        gastos: formatoRD(gastos),
        utilidad: formatoRD(ingresos - gastos),
        _utilidad: ingresos - gastos,
      };
    });
    filas.sort((a, b) => b._utilidad - a._utilidad);

    return {
      titulo: 'Rentabilidad por servicio',
      subtitulo: desde || hasta ? `Del ${desde ?? '—'} al ${hasta ?? '—'}` : 'Todo el historial',
      columnas: [
        { header: 'Servicio / materia', key: 'servicio', width: 26 },
        { header: 'Ingresos facturados', key: 'ingresos', width: 18 },
        { header: 'Gastos', key: 'gastos', width: 16 },
        { header: 'Utilidad estimada', key: 'utilidad', width: 18 },
      ],
      filas,
    };
  }

  async historialIndividual(expedienteId: string): Promise<DatosReporte> {
    const expediente = await this.expedienteRepo.findOne({ where: { id: expedienteId } });
    const [cambios, seguimientos] = await Promise.all([
      this.historialExpedienteRepo.find({ where: { expedienteId }, order: { creadoEn: 'ASC' } }),
      this.seguimientoRepo.find({ where: { expedienteId }, order: { creadoEn: 'ASC' } }),
    ]);
    const usuarios = await this.usuariosPorId([...cambios.map((c) => c.usuarioId), ...seguimientos.map((s) => s.usuarioId)]);

    type EntradaLinea = { fecha: Date; tipo: string; detalle: string; usuario: string };
    const linea: EntradaLinea[] = [
      ...cambios.map((c) => ({
        fecha: c.creadoEn,
        tipo: c.esRestauracion ? 'Restauración de versión' : 'Modificación',
        detalle: c.camposModificados.join(', ') + (c.motivo ? ` — ${c.motivo}` : ''),
        usuario: usuarios.get(c.usuarioId)?.nombreCompleto ?? '—',
      })),
      ...seguimientos.map((s) => ({
        fecha: s.creadoEn,
        tipo: s.hito ? 'Hito' : 'Nota de seguimiento',
        detalle: s.texto,
        usuario: usuarios.get(s.usuarioId)?.nombreCompleto ?? '—',
      })),
    ].sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

    return {
      titulo: `Historial del expediente ${expediente?.codigo ?? expedienteId}`,
      subtitulo: `${linea.length} entrada(s) — orden cronológico`,
      columnas: [
        { header: 'Fecha', key: 'fechaTexto', width: 18 },
        { header: 'Tipo', key: 'tipo', width: 20 },
        { header: 'Detalle', key: 'detalle', width: 46 },
        { header: 'Usuario', key: 'usuario', width: 20 },
      ],
      filas: linea.map((l) => ({
        fechaTexto: l.fecha.toLocaleString('es-DO', { dateStyle: 'medium', timeStyle: 'short' }),
        tipo: l.tipo,
        detalle: l.detalle,
        usuario: l.usuario,
      })),
    };
  }

  async historialModificaciones(desde?: string, hasta?: string): Promise<DatosReporte> {
    const qbExp = this.historialExpedienteRepo.createQueryBuilder('h');
    const qbCambios = this.historialCambioRepo.createQueryBuilder('h');
    if (desde) {
      qbExp.andWhere('h.creadoEn >= :desde', { desde });
      qbCambios.andWhere('h.creadoEn >= :desde', { desde });
    }
    if (hasta) {
      qbExp.andWhere('h.creadoEn <= :hasta', { hasta });
      qbCambios.andWhere('h.creadoEn <= :hasta', { hasta });
    }
    const [cambiosExpediente, cambiosOtros] = await Promise.all([qbExp.getMany(), qbCambios.getMany()]);

    const expedientes = await this.expedienteRepo.findBy({ id: In([...new Set(cambiosExpediente.map((c) => c.expedienteId))]) });
    const codigoPorExpediente = new Map(expedientes.map((e) => [e.id, e.codigo]));
    const usuarios = await this.usuariosPorId([...cambiosExpediente.map((c) => c.usuarioId), ...cambiosOtros.map((c) => c.usuarioId)]);

    type Fila = { fecha: Date; entidad: string; detalle: string; usuario: string; motivo: string };
    const filas: Fila[] = [
      ...cambiosExpediente.map((c) => ({
        fecha: c.creadoEn,
        entidad: `Expediente ${codigoPorExpediente.get(c.expedienteId) ?? c.expedienteId}`,
        detalle: c.camposModificados.join(', '),
        usuario: usuarios.get(c.usuarioId)?.nombreCompleto ?? '—',
        motivo: c.motivo ?? '—',
      })),
      ...cambiosOtros.map((c) => ({
        fecha: c.creadoEn,
        entidad: `${c.entidadTipo.charAt(0).toUpperCase()}${c.entidadTipo.slice(1)} ${c.entidadId}`,
        detalle: c.camposModificados.join(', '),
        usuario: usuarios.get(c.usuarioId)?.nombreCompleto ?? '—',
        motivo: c.motivo ?? '—',
      })),
    ].sort((a, b) => b.fecha.getTime() - a.fecha.getTime());

    return {
      titulo: 'Historial de modificaciones',
      subtitulo: desde || hasta ? `Del ${desde ?? '—'} al ${hasta ?? '—'}` : 'Todo el historial',
      columnas: [
        { header: 'Fecha', key: 'fechaTexto', width: 18 },
        { header: 'Entidad modificada', key: 'entidad', width: 24 },
        { header: 'Campos', key: 'detalle', width: 30 },
        { header: 'Usuario', key: 'usuario', width: 20 },
        { header: 'Motivo', key: 'motivo', width: 24 },
      ],
      filas: filas.map((f) => ({
        fechaTexto: f.fecha.toLocaleString('es-DO', { dateStyle: 'medium', timeStyle: 'short' }),
        entidad: f.entidad,
        detalle: f.detalle,
        usuario: f.usuario,
        motivo: f.motivo,
      })),
    };
  }

  async actividadUsuarios(): Promise<DatosReporte> {
    const [usuarios, expedientes, documentos, facturas, cambiosExpediente, cambiosOtros] = await Promise.all([
      this.usuarioRepo.find(),
      this.expedienteRepo.find(),
      this.documentoRepo.find(),
      this.facturaRepo.find(),
      this.historialExpedienteRepo.find(),
      this.historialCambioRepo.find(),
    ]);

    const filas = usuarios.map((u) => {
      const expedientesAsignados = expedientes.filter((e) => e.abogadoResponsableId === u.id).length;
      const documentosSubidos = documentos.filter((d) => d.subidoPorId === u.id).length;
      const facturasEmitidas = facturas.filter((f) => f.creadoPorId === u.id).length;
      const cambiosRegistrados =
        cambiosExpediente.filter((c) => c.usuarioId === u.id).length + cambiosOtros.filter((c) => c.usuarioId === u.id).length;
      return {
        usuario: u.nombreCompleto,
        rol: u.rol.replace(/_/g, ' '),
        estado: u.estado.replace(/_/g, ' '),
        ultimoAcceso: u.ultimoAcceso ? u.ultimoAcceso.toLocaleString('es-DO', { dateStyle: 'medium', timeStyle: 'short' }) : 'Nunca',
        documentosSubidos,
        facturasEmitidas,
        cambiosRegistrados,
        expedientesAsignados,
      };
    });

    return {
      titulo: 'Actividad de usuarios',
      columnas: [
        { header: 'Usuario', key: 'usuario', width: 22 },
        { header: 'Rol', key: 'rol', width: 20 },
        { header: 'Estado', key: 'estado', width: 14 },
        { header: 'Último acceso', key: 'ultimoAcceso', width: 20 },
        { header: 'Expedientes asignados', key: 'expedientesAsignados', width: 16 },
        { header: 'Documentos subidos', key: 'documentosSubidos', width: 16 },
        { header: 'Facturas emitidas', key: 'facturasEmitidas', width: 16 },
        { header: 'Cambios registrados', key: 'cambiosRegistrados', width: 16 },
      ],
      filas,
    };
  }
}
