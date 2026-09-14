import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager, In } from 'typeorm';
import { Cotizacion } from './cotizacion.entity.js';
import { Factura } from './factura.entity.js';
import { Pago } from './pago.entity.js';
import { Cliente } from '../clientes/cliente.entity.js';
import { Expediente } from '../expedientes/expediente.entity.js';
import { ClientesService, type PosibleDuplicado } from '../clientes/clientes.service.js';
import { CreateCotizacionDto } from './dto/cotizacion.dto.js';
import { CreateFacturaDto, UpdateFacturaDto } from './dto/factura.dto.js';
import { CreatePagoDto } from './dto/pago.dto.js';
import { calcularTotales } from './item-facturable.js';
import { EstadoCotizacion, EstadoFactura, TipoCliente } from '../common/enums/index.js';
import { HistorialCambiosService } from '../historial-cambios/historial-cambios.service.js';
import { parsearPaginacion, type ResultadoPaginado } from '../common/paginacion/paginacion.js';

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function nombreCliente(cliente: Cliente): string {
  if (!cliente) return '';
  return cliente.tipo === TipoCliente.JURIDICO
    ? (cliente.razonSocial ?? cliente.nombreComercial ?? '')
    : `${cliente.nombres ?? ''} ${cliente.apellidos ?? ''}`.trim();
}

@Injectable()
export class FacturacionService {
  constructor(
    @InjectRepository(Cotizacion)
    private readonly cotizacionRepo: Repository<Cotizacion>,
    @InjectRepository(Factura)
    private readonly facturaRepo: Repository<Factura>,
    @InjectRepository(Pago)
    private readonly pagoRepo: Repository<Pago>,
    @InjectRepository(Cliente)
    private readonly clienteRepo: Repository<Cliente>,
    @InjectRepository(Expediente)
    private readonly expedienteRepo: Repository<Expediente>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly historialCambiosService: HistorialCambiosService,
    private readonly clientesService: ClientesService,
  ) {}

  // --- Numeración ---------------------------------------------------------

  private async generarNumero(
    prefijo: 'COT' | 'FAC',
    repo: Repository<Cotizacion> | Repository<Factura>,
  ): Promise<string> {
    const anio = new Date().getFullYear();
    const patron = `${prefijo}-${anio}-%`;

    const ultimo = await (repo as Repository<any>)
      .createQueryBuilder('x')
      .where('x.numero LIKE :patron', { patron })
      .orderBy('x.numero', 'DESC')
      .getOne();

    let siguiente = 1;
    if (ultimo) {
      const partes = ultimo.numero.split('-');
      siguiente = parseInt(partes[partes.length - 1], 10) + 1;
    }
    return `${prefijo}-${anio}-${String(siguiente).padStart(4, '0')}`;
  }

  // --- Cotizaciones --------------------------------------------------------

  /**
   * Si `dto.clienteId` no viene, se espera `dto.clienteNuevo` -- se crea el
   * cliente primero (con la misma detección de duplicados que
   * ClientesController.crear) y, si todo bien, se usa su id para la
   * cotización. Si ClientesService detecta un posible duplicado, no se crea
   * nada (ni cliente ni cotización) y se devuelve `duplicados` para que la
   * interfaz le pregunte al usuario, igual que en el formulario de clientes.
   */
  async crearCotizacion(
    dto: CreateCotizacionDto,
    usuarioId: string,
  ): Promise<Cotizacion | { duplicados: PosibleDuplicado[] }> {
    const { clienteNuevo, forzarClienteDuplicado, ...datosCotizacion } = dto;
    let clienteId = datosCotizacion.clienteId;

    if (!clienteId) {
      if (!clienteNuevo) {
        throw new BadRequestException(
          'Debe indicar un cliente existente (clienteId) o los datos de un cliente nuevo (clienteNuevo).',
        );
      }
      const resultado = await this.clientesService.crear(clienteNuevo, {
        forzarPeseADuplicado: forzarClienteDuplicado,
        usuarioId,
      });
      if (resultado.duplicados) {
        return { duplicados: resultado.duplicados };
      }
      clienteId = resultado.cliente!.id;
    }

    const aplicaItbisGeneral = dto.aplicaItbis ?? true;
    const totales = calcularTotales(dto.items, aplicaItbisGeneral, dto.descuento);
    const costoEnvio = dto.costoEnvio ?? 0;
    const numero = await this.generarNumero('COT', this.cotizacionRepo);

    const cotizacion = this.cotizacionRepo.create({
      ...datosCotizacion,
      clienteId,
      numero,
      subtotal: totales.subtotal,
      descuento: totales.descuento,
      itbis: totales.itbis,
      aplicaItbis: totales.aplicaItbis,
      costoEnvio: costoEnvio.toFixed(2),
      total: (Number(totales.total) + costoEnvio).toFixed(2),
      creadoPorId: usuarioId,
    });
    return this.cotizacionRepo.save(cotizacion);
  }

  async listarCotizaciones(
    filtros: {
      clienteId?: string;
      expedienteId?: string;
      estado?: EstadoCotizacion;
    },
    paginacion?: { pagina?: string; porPagina?: string },
  ): Promise<Cotizacion[] | ResultadoPaginado<Cotizacion>> {
    const where = {
      ...(filtros.clienteId ? { clienteId: filtros.clienteId } : {}),
      ...(filtros.expedienteId ? { expedienteId: filtros.expedienteId } : {}),
      ...(filtros.estado ? { estado: filtros.estado } : {}),
    };

    // Paginación opcional (hallazgo de la auditoría) -- sin pagina/porPagina
    // en la query, se comporta exactamente igual que antes.
    const params = parsearPaginacion(paginacion?.pagina, paginacion?.porPagina);
    if (!params) {
      return this.cotizacionRepo.find({ where, order: { creadoEn: 'DESC' } });
    }

    const [datos, total] = await this.cotizacionRepo.findAndCount({
      where,
      order: { creadoEn: 'DESC' },
      skip: (params.pagina - 1) * params.porPagina,
      take: params.porPagina,
    });
    return { datos, total, pagina: params.pagina, porPagina: params.porPagina };
  }

  async obtenerCotizacion(id: string): Promise<Cotizacion> {
    const cotizacion = await this.cotizacionRepo.findOne({ where: { id } });
    if (!cotizacion) throw new NotFoundException('Cotización no encontrada');
    return cotizacion;
  }

  async cambiarEstadoCotizacion(id: string, estado: EstadoCotizacion): Promise<Cotizacion> {
    const cotizacion = await this.obtenerCotizacion(id);
    if (cotizacion.estado === EstadoCotizacion.CONVERTIDA) {
      throw new BadRequestException(
        'Esta cotización ya fue convertida en factura y no se puede modificar.',
      );
    }
    await this.cotizacionRepo.update(id, { estado });
    return this.obtenerCotizacion(id);
  }

  async convertirCotizacionAFactura(id: string, usuarioId: string): Promise<Factura> {
    const cotizacion = await this.obtenerCotizacion(id);
    if (cotizacion.estado === EstadoCotizacion.CONVERTIDA) {
      throw new BadRequestException('Esta cotización ya fue convertida en factura.');
    }
    if (cotizacion.estado !== EstadoCotizacion.ACEPTADA) {
      throw new BadRequestException(
        'Solo se puede facturar una cotización marcada como aceptada por el cliente.',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const factura = await this.crearFacturaInterna(
        {
          clienteId: cotizacion.clienteId,
          expedienteId: cotizacion.expedienteId,
          concepto: cotizacion.concepto,
          items: cotizacion.items,
          aplicaItbis: cotizacion.aplicaItbis,
          descuento: Number(cotizacion.descuento),
          condicionesPago: cotizacion.condicionesPago,
          numeroOrdenCompra: cotizacion.numeroOrdenCompra,
          vendedor: cotizacion.vendedor,
          direccionFacturacion: cotizacion.direccionFacturacion,
          direccionEnvio: cotizacion.direccionEnvio,
          costoEnvio: Number(cotizacion.costoEnvio),
        },
        usuarioId,
        manager,
      );
      await manager
        .getRepository(Factura)
        .update(factura.id, { cotizacionId: cotizacion.id });
      await manager
        .getRepository(Cotizacion)
        .update(cotizacion.id, { estado: EstadoCotizacion.CONVERTIDA });
      return factura;
    });
  }

  /**
   * Elimina una cotizacion por completo -- no lleva peso fiscal (no es un
   * comprobante), asi que se puede borrar sin dejar rastro. Si ya fue
   * convertida en factura, la factura generada NO se toca -- solo se pierde
   * el registro de la cotizacion que la origino.
   */
  async eliminarCotizacion(id: string): Promise<void> {
    await this.obtenerCotizacion(id); // 404 si no existe
    await this.cotizacionRepo.delete(id);
  }

  /**
   * Duplica una cotización existente: crea una nueva con el mismo cliente,
   * expediente, items y condiciones, pero número nuevo, estado "borrador"
   * (sin importar el estado del original) y sin fecha de vigencia (para que
   * el usuario la revise/ajuste antes de enviarla). Pensada como el
   * equivalente práctico de "Crear duplicado" de Brisk, respetando la regla
   * de que las facturas no se crean sueltas -- aquí solo se duplica la
   * cotización, nunca una factura.
   */
  async duplicarCotizacion(id: string, usuarioId: string): Promise<Cotizacion> {
    const original = await this.obtenerCotizacion(id);
    const numero = await this.generarNumero('COT', this.cotizacionRepo);

    const duplicado = this.cotizacionRepo.create({
      clienteId: original.clienteId,
      expedienteId: original.expedienteId,
      concepto: original.concepto,
      items: original.items,
      aplicaItbis: original.aplicaItbis,
      subtotal: original.subtotal,
      descuento: original.descuento,
      itbis: original.itbis,
      total: original.total,
      numero,
      estado: EstadoCotizacion.BORRADOR,
      notas: original.notas,
      condicionesPago: original.condicionesPago,
      numeroOrdenCompra: original.numeroOrdenCompra,
      vendedor: original.vendedor,
      direccionFacturacion: original.direccionFacturacion,
      direccionEnvio: original.direccionEnvio,
      costoEnvio: original.costoEnvio,
      creadoPorId: usuarioId,
    });
    return this.cotizacionRepo.save(duplicado);
  }

  // --- Facturas --------------------------------------------------------

  private async crearFacturaInterna(
    dto: {
      clienteId: string;
      expedienteId?: string;
      concepto?: string;
      items: {
        descripcion: string;
        cantidad: number;
        precioUnitario: number;
        codigoArticulo?: string;
        aplicaItbis?: boolean;
      }[];
      aplicaItbis?: boolean;
      descuento?: number;
      fechaEmision?: string;
      fechaVencimiento?: string;
      ncf?: string;
      notas?: string;
      condicionesPago?: string;
      numeroOrdenCompra?: string;
      vendedor?: string;
      direccionFacturacion?: string;
      direccionEnvio?: string;
      costoEnvio?: number;
      enlacePago?: string;
    },
    usuarioId: string,
    manager: EntityManager,
  ): Promise<Factura> {
    const facturaRepo = manager.getRepository(Factura);
    const aplicaItbisGeneral = dto.aplicaItbis ?? true;
    const totales = calcularTotales(dto.items, aplicaItbisGeneral, dto.descuento);
    const costoEnvio = dto.costoEnvio ?? 0;
    const numero = await this.generarNumero('FAC', facturaRepo as any);

    const factura = facturaRepo.create({
      numero,
      clienteId: dto.clienteId,
      expedienteId: dto.expedienteId,
      concepto: dto.concepto ?? 'Servicios legales',
      items: dto.items,
      subtotal: totales.subtotal,
      descuento: totales.descuento,
      itbis: totales.itbis,
      aplicaItbis: totales.aplicaItbis,
      costoEnvio: costoEnvio.toFixed(2),
      total: (Number(totales.total) + costoEnvio).toFixed(2),
      ncf: dto.ncf,
      notas: dto.notas,
      condicionesPago: dto.condicionesPago,
      numeroOrdenCompra: dto.numeroOrdenCompra,
      vendedor: dto.vendedor,
      direccionFacturacion: dto.direccionFacturacion,
      direccionEnvio: dto.direccionEnvio,
      enlacePago: dto.enlacePago,
      fechaEmision: dto.fechaEmision ?? hoyISO(),
      fechaVencimiento: dto.fechaVencimiento,
      creadoPorId: usuarioId,
    });
    const guardada = await facturaRepo.save(factura);

    if (guardada.expedienteId) {
      await this.recalcularBalanceExpediente(guardada.expedienteId, manager);
    }
    return guardada;
  }

  async crearFactura(dto: CreateFacturaDto, usuarioId: string): Promise<Factura> {
    return this.dataSource.transaction((manager) =>
      this.crearFacturaInterna(dto, usuarioId, manager),
    );
  }

  async listarFacturas(
    filtros: {
      clienteId?: string;
      expedienteId?: string;
      estado?: EstadoFactura;
    },
    paginacion?: { pagina?: string; porPagina?: string },
  ): Promise<Factura[] | ResultadoPaginado<Factura>> {
    const where = {
      ...(filtros.clienteId ? { clienteId: filtros.clienteId } : {}),
      ...(filtros.expedienteId ? { expedienteId: filtros.expedienteId } : {}),
      ...(filtros.estado ? { estado: filtros.estado } : {}),
    };

    // Paginación opcional (hallazgo de la auditoría) -- sin pagina/porPagina
    // en la query, se comporta exactamente igual que antes.
    const params = parsearPaginacion(paginacion?.pagina, paginacion?.porPagina);
    if (!params) {
      return this.facturaRepo.find({ where, order: { fechaEmision: 'DESC' } });
    }

    const [datos, total] = await this.facturaRepo.findAndCount({
      where,
      order: { fechaEmision: 'DESC' },
      skip: (params.pagina - 1) * params.porPagina,
      take: params.porPagina,
    });
    return { datos, total, pagina: params.pagina, porPagina: params.porPagina };
  }

  async obtenerFactura(id: string): Promise<Factura> {
    const factura = await this.facturaRepo.findOne({ where: { id } });
    if (!factura) throw new NotFoundException('Factura no encontrada');
    return factura;
  }

  /**
   * Edita los campos de una factura ya guardada (concepto, items, fechas,
   * NCF, notas, direcciones, etc). Reservado a SUPERADMINISTRADOR -- ver
   * el guard en FacturasController. No permite editar montoPagado/estado
   * directamente: esos siguen siendo derivados de los pagos registrados
   * (registrarPago/eliminarPago), para no perder la trazabilidad de quién
   * pagó qué y cuándo. Si cambian items/descuento/ITBIS/envío se
   * recalculan subtotal/itbis/total, y el estado se vuelve a derivar
   * comparando el nuevo total contra el monto ya pagado.
   */
  async actualizarFactura(id: string, dto: UpdateFacturaDto, usuarioId: string): Promise<Factura> {
    return this.dataSource.transaction(async (manager) => {
      const facturaRepo = manager.getRepository(Factura);
      const factura = await facturaRepo.findOne({ where: { id } });
      if (!factura) throw new NotFoundException('Factura no encontrada');
      if (factura.estado === EstadoFactura.ANULADA) {
        throw new BadRequestException('No se puede editar una factura anulada.');
      }
      const snapshotAnterior = { ...factura };

      const items = dto.items ?? factura.items;
      const aplicaItbisGeneral = dto.aplicaItbis ?? factura.aplicaItbis;
      const descuento = dto.descuento ?? Number(factura.descuento);
      const costoEnvio = dto.costoEnvio ?? Number(factura.costoEnvio);
      const totales = calcularTotales(items, aplicaItbisGeneral, descuento);
      const nuevoTotal = Number(totales.total) + costoEnvio;

      const montoPagado = Number(factura.montoPagado);
      if (nuevoTotal < montoPagado) {
        throw new BadRequestException(
          `El nuevo total (RD$ ${nuevoTotal.toFixed(2)}) no puede quedar por debajo del monto ya pagado (RD$ ${montoPagado.toFixed(2)}). Ajusta primero los pagos registrados.`,
        );
      }

      let nuevoEstado = EstadoFactura.PENDIENTE;
      if (montoPagado >= nuevoTotal && montoPagado > 0) nuevoEstado = EstadoFactura.PAGADA;
      else if (montoPagado > 0) nuevoEstado = EstadoFactura.PAGADA_PARCIAL;

      await facturaRepo.update(id, {
        concepto: dto.concepto ?? factura.concepto,
        items,
        aplicaItbis: aplicaItbisGeneral,
        subtotal: totales.subtotal,
        descuento: totales.descuento,
        itbis: totales.itbis,
        costoEnvio: costoEnvio.toFixed(2),
        total: nuevoTotal.toFixed(2),
        estado: nuevoEstado,
        fechaEmision: dto.fechaEmision ?? factura.fechaEmision,
        fechaVencimiento: dto.fechaVencimiento ?? factura.fechaVencimiento,
        ncf: dto.ncf ?? factura.ncf,
        notas: dto.notas ?? factura.notas,
        condicionesPago: dto.condicionesPago ?? factura.condicionesPago,
        numeroOrdenCompra: dto.numeroOrdenCompra ?? factura.numeroOrdenCompra,
        vendedor: dto.vendedor ?? factura.vendedor,
        direccionFacturacion: dto.direccionFacturacion ?? factura.direccionFacturacion,
        direccionEnvio: dto.direccionEnvio ?? factura.direccionEnvio,
        enlacePago: dto.enlacePago ?? factura.enlacePago,
      });

      if (factura.expedienteId) {
        await this.recalcularBalanceExpediente(factura.expedienteId, manager);
      }
      const actualizada = (await facturaRepo.findOne({ where: { id } })) as Factura;
      await this.historialCambiosService.registrarCambio(
        {
          entidadTipo: 'factura',
          entidadId: id,
          snapshotAnterior,
          snapshotNuevo: { ...actualizada },
          usuarioId,
        },
        manager,
      );
      return actualizada;
    });
  }

  async anularFactura(id: string, usuarioId: string): Promise<Factura> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Factura);
      const factura = await repo.findOne({ where: { id } });
      if (!factura) throw new NotFoundException('Factura no encontrada');
      if (Number(factura.montoPagado) > 0) {
        throw new BadRequestException(
          'No se puede anular una factura que ya tiene pagos registrados. Registra una nota de crédito o contacta a contabilidad.',
        );
      }
      await repo.update(id, { estado: EstadoFactura.ANULADA });
      if (factura.expedienteId) {
        await this.recalcularBalanceExpediente(factura.expedienteId, manager);
      }
      const anulada = (await repo.findOne({ where: { id } })) as Factura;
      await this.historialCambiosService.registrarCambio(
        {
          entidadTipo: 'factura',
          entidadId: id,
          snapshotAnterior: { estado: factura.estado },
          snapshotNuevo: { estado: anulada.estado },
          usuarioId,
          motivo: 'Factura anulada',
        },
        manager,
      );
      return anulada;
    });
  }

  async historialFactura(id: string) {
    await this.obtenerFactura(id); // 404 si no existe
    return this.historialCambiosService.listarPorEntidad('factura', id);
  }

  // --- Pagos --------------------------------------------------------

  async registrarPago(
    facturaId: string,
    dto: CreatePagoDto,
    usuarioId: string,
  ): Promise<Pago> {
    return this.dataSource.transaction(async (manager) => {
      const facturaRepo = manager.getRepository(Factura);
      const pagoRepo = manager.getRepository(Pago);

      const factura = await facturaRepo.findOne({ where: { id: facturaId } });
      if (!factura) throw new NotFoundException('Factura no encontrada');
      if (factura.estado === EstadoFactura.ANULADA) {
        throw new BadRequestException('No se puede registrar un pago sobre una factura anulada.');
      }

      const pago = pagoRepo.create({
        facturaId,
        monto: dto.monto.toFixed(2),
        metodo: dto.metodo,
        referencia: dto.referencia,
        fecha: dto.fecha ?? hoyISO(),
        notas: dto.notas,
        registradoPorId: usuarioId,
      });
      const guardado = await pagoRepo.save(pago);

      const pagosFactura = await pagoRepo.find({ where: { facturaId } });
      const totalPagado = pagosFactura.reduce((acc, p) => acc + Number(p.monto), 0);

      let nuevoEstado = EstadoFactura.PENDIENTE;
      if (totalPagado >= Number(factura.total)) nuevoEstado = EstadoFactura.PAGADA;
      else if (totalPagado > 0) nuevoEstado = EstadoFactura.PAGADA_PARCIAL;

      await facturaRepo.update(facturaId, {
        montoPagado: totalPagado.toFixed(2),
        estado: nuevoEstado,
      });

      if (factura.expedienteId) {
        await this.recalcularBalanceExpediente(factura.expedienteId, manager);
      }
      return guardado;
    });
  }

  /**
   * Elimina una factura por completo -- pensado para corregir una factura
   * mal cargada (duplicada, creada por error), no como flujo normal (para
   * anular una factura valida ya emitida, usa anularFactura en vez de
   * esto). Bloqueado si ya tiene pagos registrados -- hay que eliminar esos
   * pagos primero con eliminarPago.
   */
  async eliminarFactura(id: string): Promise<void> {
    return this.dataSource.transaction(async (manager) => {
      const facturaRepo = manager.getRepository(Factura);
      const factura = await facturaRepo.findOne({ where: { id } });
      if (!factura) throw new NotFoundException('Factura no encontrada');
      if (Number(factura.montoPagado) > 0) {
        throw new BadRequestException(
          'No se puede eliminar una factura con pagos registrados. Elimina primero sus pagos (o anúlala si prefieres conservar el registro).',
        );
      }
      await facturaRepo.delete(id);
      if (factura.expedienteId) {
        await this.recalcularBalanceExpediente(factura.expedienteId, manager);
      }
    });
  }

  /**
   * Elimina un pago registrado por error y recalcula el saldo/estado de su
   * factura, tal como lo hace registrarPago pero a la inversa.
   */
  async eliminarPago(facturaId: string, pagoId: string): Promise<void> {
    return this.dataSource.transaction(async (manager) => {
      const facturaRepo = manager.getRepository(Factura);
      const pagoRepo = manager.getRepository(Pago);

      const factura = await facturaRepo.findOne({ where: { id: facturaId } });
      if (!factura) throw new NotFoundException('Factura no encontrada');
      const pago = await pagoRepo.findOne({ where: { id: pagoId, facturaId } });
      if (!pago) throw new NotFoundException('Pago no encontrado');

      await pagoRepo.delete(pagoId);

      const pagosRestantes = await pagoRepo.find({ where: { facturaId } });
      const totalPagado = pagosRestantes.reduce((acc, p) => acc + Number(p.monto), 0);

      let nuevoEstado = EstadoFactura.PENDIENTE;
      if (totalPagado >= Number(factura.total)) nuevoEstado = EstadoFactura.PAGADA;
      else if (totalPagado > 0) nuevoEstado = EstadoFactura.PAGADA_PARCIAL;

      await facturaRepo.update(facturaId, {
        montoPagado: totalPagado.toFixed(2),
        estado: nuevoEstado,
      });

      if (factura.expedienteId) {
        await this.recalcularBalanceExpediente(factura.expedienteId, manager);
      }
    });
  }

  async listarPagos(facturaId: string): Promise<Pago[]> {
    return this.pagoRepo.find({ where: { facturaId }, order: { fecha: 'DESC' } });
  }

  // --- Balance de expediente (mantiene vivo el campo balancePendiente) ----

  private async recalcularBalanceExpediente(
    expedienteId: string,
    manager: EntityManager,
  ): Promise<void> {
    const facturaRepo = manager.getRepository(Factura);
    const facturas = await facturaRepo.find({ where: { expedienteId } });
    const activas = facturas.filter((f) => f.estado !== EstadoFactura.ANULADA);
    const totalFacturado = activas.reduce((a, f) => a + Number(f.total), 0);
    const totalPagado = activas.reduce((a, f) => a + Number(f.montoPagado), 0);
    const balance = Math.max(totalFacturado - totalPagado, 0);
    await manager
      .getRepository(Expediente)
      .update(expedienteId, { balancePendiente: balance.toFixed(2) });
  }

  // --- Estado de cuenta por cliente --------------------------------------

  async estadoDeCuenta(clienteId: string) {
    const cliente = await this.clienteRepo.findOne({ where: { id: clienteId } });
    if (!cliente) throw new NotFoundException('Cliente no encontrado');

    const facturas = await this.facturaRepo.find({
      where: { clienteId },
      order: { fechaEmision: 'DESC' },
    });

    const facturasConSaldo = facturas.map((f) => ({
      ...f,
      saldoPendiente:
        f.estado === EstadoFactura.ANULADA
          ? '0.00'
          : (Number(f.total) - Number(f.montoPagado)).toFixed(2),
    }));

    const activas = facturas.filter((f) => f.estado !== EstadoFactura.ANULADA);
    const totalFacturado = activas.reduce((a, f) => a + Number(f.total), 0);
    const totalPagado = activas.reduce((a, f) => a + Number(f.montoPagado), 0);

    return {
      cliente: {
        id: cliente.id,
        codigoCliente: cliente.codigoCliente,
        nombre: nombreCliente(cliente),
      },
      facturas: facturasConSaldo,
      totalFacturado: totalFacturado.toFixed(2),
      totalPagado: totalPagado.toFixed(2),
      totalPendiente: (totalFacturado - totalPagado).toFixed(2),
    };
  }

  // --- Dashboard financiero -----------------------------------------------

  async dashboardFinanciero() {
    const facturas = await this.facturaRepo.find();
    const pagos = await this.pagoRepo.find();
    const cotizacionesPendientes = await this.cotizacionRepo.count({
      where: { estado: In([EstadoCotizacion.BORRADOR, EstadoCotizacion.ENVIADA]) },
    });

    const activas = facturas.filter((f) => f.estado !== EstadoFactura.ANULADA);
    const totalPendienteGlobal = activas.reduce(
      (a, f) => a + (Number(f.total) - Number(f.montoPagado)),
      0,
    );

    const hoy = hoyISO();
    const facturasVencidas = activas.filter(
      (f) => f.fechaVencimiento && f.fechaVencimiento < hoy && f.estado !== EstadoFactura.PAGADA,
    );

    // Últimos 6 meses: facturado (por fecha de emisión) vs. cobrado (por
    // fecha de cada pago) — dos series comparables mes a mes.
    const meses: { clave: string; etiqueta: string }[] = [];
    const ahora = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
      const clave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const etiqueta = d.toLocaleDateString('es-DO', { month: 'short', year: '2-digit' });
      meses.push({ clave, etiqueta });
    }

    const porMes = meses.map(({ clave, etiqueta }) => {
      const facturado = activas
        .filter((f) => f.fechaEmision?.startsWith(clave))
        .reduce((a, f) => a + Number(f.total), 0);
      const cobrado = pagos
        .filter((p) => p.fecha?.startsWith(clave))
        .reduce((a, p) => a + Number(p.monto), 0);
      return { mes: etiqueta, facturado: Number(facturado.toFixed(2)), cobrado: Number(cobrado.toFixed(2)) };
    });

    return {
      totalPendienteGlobal: totalPendienteGlobal.toFixed(2),
      facturasVencidas: facturasVencidas.length,
      cotizacionesPendientes,
      porMes,
    };
  }
}
