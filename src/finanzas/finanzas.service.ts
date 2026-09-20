import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { CategoriaFinanciera } from './categoria-financiera.entity.js';
import { MovimientoFinanciero } from './movimiento-financiero.entity.js';
import { Pago } from '../facturacion/pago.entity.js';
import { Factura } from '../facturacion/factura.entity.js';
import { CreateCategoriaFinancieraDto, UpdateCategoriaFinancieraDto } from './dto/categoria-financiera.dto.js';
import { CreateMovimientoFinancieroDto, UpdateMovimientoFinancieroDto } from './dto/movimiento-financiero.dto.js';
import { TipoMovimientoFinanciero } from '../common/enums/index.js';

// Vista unificada que ve el front: un movimiento manual (categoriaId real,
// editable/eliminable) o un pago de factura ya cobrado (de solo lectura
// aquí -- se corrige desde Facturas, nunca desde Control de Gastos, para no
// tener dos lugares editando el mismo dato).
export interface MovimientoFinancieroVista {
  id: string;
  tipo: TipoMovimientoFinanciero;
  categoriaId: string | null;
  categoriaNombre: string;
  concepto: string;
  monto: string;
  fecha: string;
  metodoPago?: string;
  notas?: string;
  registradoPorId?: string;
  creadoEn: Date | string;
  origen: 'manual' | 'factura';
  facturaId?: string;
  facturaNumero?: string;
}

function sumar(movimientos: MovimientoFinanciero[]): number {
  return movimientos.reduce((acc, m) => acc + Number(m.monto), 0);
}

function sumarPagos(pagos: Pago[]): number {
  return pagos.reduce((acc, p) => acc + Number(p.monto), 0);
}

function rangoDelMes(anio: number, mes: number): { inicio: string; fin: string } {
  const inicio = `${anio}-${String(mes).padStart(2, '0')}-01`;
  const fin = new Date(anio, mes, 0).toISOString().slice(0, 10);
  return { inicio, fin };
}

@Injectable()
export class FinanzasService {
  constructor(
    @InjectRepository(CategoriaFinanciera)
    private readonly categoriasRepo: Repository<CategoriaFinanciera>,
    @InjectRepository(MovimientoFinanciero)
    private readonly movimientosRepo: Repository<MovimientoFinanciero>,
    @InjectRepository(Pago)
    private readonly pagosRepo: Repository<Pago>,
    @InjectRepository(Factura)
    private readonly facturasRepo: Repository<Factura>,
  ) {}

  listarCategorias(tipo?: TipoMovimientoFinanciero, incluirInactivas = false) {
    return this.categoriasRepo.find({
      where: {
        ...(tipo ? { tipo } : {}),
        ...(incluirInactivas ? {} : { activa: true }),
      },
      order: { nombre: 'ASC' },
    });
  }

  async crearCategoria(dto: CreateCategoriaFinancieraDto) {
    const categoria = this.categoriasRepo.create({
      nombre: dto.nombre,
      tipo: dto.tipo,
      presupuestoMensual: dto.presupuestoMensual != null ? String(dto.presupuestoMensual) : undefined,
    });
    return this.categoriasRepo.save(categoria);
  }

  async actualizarCategoria(id: string, dto: UpdateCategoriaFinancieraDto) {
    const categoria = await this.categoriasRepo.findOneBy({ id });
    if (!categoria) throw new NotFoundException('Categoría no encontrada');
    if (dto.nombre !== undefined) categoria.nombre = dto.nombre;
    if (dto.presupuestoMensual !== undefined) categoria.presupuestoMensual = String(dto.presupuestoMensual);
    if (dto.activa !== undefined) categoria.activa = dto.activa;
    return this.categoriasRepo.save(categoria);
  }

  // Pagos de facturas ya cobrados, vistos como ingreso -- así el usuario no
  // tiene que volver a teclearlos a mano en Control de Gastos. Se muestran
  // bajo una categoría fija (no editable) porque no pertenecen a ninguna
  // fila real de categorias_financieras.
  private async pagosComoIngresos(desde?: string, hasta?: string): Promise<MovimientoFinancieroVista[]> {
    const pagos = await this.pagosRepo.find({
      where: desde && hasta ? { fecha: Between(desde, hasta) } : {},
      order: { fecha: 'DESC' },
    });
    if (pagos.length === 0) return [];

    const facturaIds = [...new Set(pagos.map((p) => p.facturaId))];
    const facturas = await this.facturasRepo.findBy({ id: In(facturaIds) });
    const numeroPorFactura = new Map(facturas.map((f) => [f.id, f.numero]));

    return pagos.map((p) => {
      const numero = numeroPorFactura.get(p.facturaId);
      return {
        id: `pago:${p.id}`,
        tipo: TipoMovimientoFinanciero.INGRESO,
        categoriaId: null,
        categoriaNombre: 'Honorarios profesionales (pago de factura)',
        concepto: numero ? `Pago de factura ${numero}` : 'Pago de factura',
        monto: p.monto,
        fecha: p.fecha,
        metodoPago: p.metodo,
        notas: p.referencia,
        creadoEn: p.creadoEn,
        origen: 'factura' as const,
        facturaId: p.facturaId,
        facturaNumero: numero,
      };
    });
  }

  async listarMovimientos(filtros: {
    tipo?: TipoMovimientoFinanciero;
    categoriaId?: string;
    desde?: string;
    hasta?: string;
  }): Promise<MovimientoFinancieroVista[]> {
    const where: Record<string, unknown> = {};
    if (filtros.tipo) where.tipo = filtros.tipo;
    if (filtros.categoriaId) where.categoriaId = filtros.categoriaId;
    if (filtros.desde && filtros.hasta) where.fecha = Between(filtros.desde, filtros.hasta);

    const [manuales, categorias] = await Promise.all([
      this.movimientosRepo.find({ where, order: { fecha: 'DESC', creadoEn: 'DESC' } }),
      this.categoriasRepo.find(),
    ]);
    const nombrePorCategoria = new Map(categorias.map((c) => [c.id, c.nombre]));

    const vistaManuales: MovimientoFinancieroVista[] = manuales.map((m) => ({
      id: m.id,
      tipo: m.tipo,
      categoriaId: m.categoriaId,
      categoriaNombre: nombrePorCategoria.get(m.categoriaId) ?? '—',
      concepto: m.concepto,
      monto: m.monto,
      fecha: m.fecha,
      metodoPago: m.metodoPago,
      notas: m.notas,
      registradoPorId: m.registradoPorId,
      creadoEn: m.creadoEn,
      origen: 'manual',
    }));

    // Los pagos de facturas cuentan como ingreso automáticamente, salvo que
    // se esté pidiendo explícitamente solo gastos o solo una categoría
    // puntual (los pagos no pertenecen a ninguna categoría editable).
    const incluirPagos = filtros.tipo !== TipoMovimientoFinanciero.GASTO && !filtros.categoriaId;
    const vistaPagos = incluirPagos ? await this.pagosComoIngresos(filtros.desde, filtros.hasta) : [];

    return [...vistaManuales, ...vistaPagos].sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
  }

  async crearMovimiento(dto: CreateMovimientoFinancieroDto, usuarioId: string) {
    const movimiento = this.movimientosRepo.create({
      tipo: dto.tipo,
      categoriaId: dto.categoriaId,
      concepto: dto.concepto,
      monto: String(dto.monto),
      fecha: dto.fecha ?? new Date().toISOString().slice(0, 10),
      metodoPago: dto.metodoPago,
      notas: dto.notas,
      registradoPorId: usuarioId,
    });
    return this.movimientosRepo.save(movimiento);
  }

  async actualizarMovimiento(id: string, dto: UpdateMovimientoFinancieroDto) {
    const movimiento = await this.movimientosRepo.findOneBy({ id });
    if (!movimiento) throw new NotFoundException('Movimiento no encontrado');
    if (dto.categoriaId !== undefined) movimiento.categoriaId = dto.categoriaId;
    if (dto.concepto !== undefined) movimiento.concepto = dto.concepto;
    if (dto.monto !== undefined) movimiento.monto = String(dto.monto);
    if (dto.fecha !== undefined) movimiento.fecha = dto.fecha;
    if (dto.metodoPago !== undefined) movimiento.metodoPago = dto.metodoPago;
    if (dto.notas !== undefined) movimiento.notas = dto.notas;
    return this.movimientosRepo.save(movimiento);
  }

  async eliminarMovimiento(id: string) {
    const movimiento = await this.movimientosRepo.findOneBy({ id });
    if (!movimiento) throw new NotFoundException('Movimiento no encontrado');
    await this.movimientosRepo.remove(movimiento);
    return { eliminado: true };
  }

  async panel(anioParam?: number, mesParam?: number) {
    const ahora = new Date();
    const anio = anioParam ?? ahora.getFullYear();
    const mes = mesParam ?? ahora.getMonth() + 1;

    const { inicio: inicioMes, fin: finMes } = rangoDelMes(anio, mes);
    const [movimientosMes, pagosMes] = await Promise.all([
      this.movimientosRepo.find({ where: { fecha: Between(inicioMes, finMes) } }),
      this.pagosRepo.find({ where: { fecha: Between(inicioMes, finMes) } }),
    ]);

    const totalIngresos =
      sumar(movimientosMes.filter((m) => m.tipo === TipoMovimientoFinanciero.INGRESO)) + sumarPagos(pagosMes);
    const totalGastos = sumar(movimientosMes.filter((m) => m.tipo === TipoMovimientoFinanciero.GASTO));

    const categorias = await this.categoriasRepo.find({ where: { activa: true } });
    const porCategoria = categorias
      .filter((c) => c.tipo === TipoMovimientoFinanciero.GASTO)
      .map((c) => {
        const gastado = sumar(movimientosMes.filter((m) => m.categoriaId === c.id));
        const presupuesto = c.presupuestoMensual ? Number(c.presupuestoMensual) : 0;
        return {
          categoriaId: c.id,
          nombre: c.nombre,
          presupuesto,
          gastado,
          porcentajeUsado: presupuesto > 0 ? gastado / presupuesto : null,
        };
      })
      .sort((a, b) => b.gastado - a.gastado);

    // Tendencia de los últimos 6 meses (incluyendo el mes de referencia) --
    // una consulta por mes es simple y de sobra para el volumen de un
    // despacho de este tamaño; se puede optimizar con un solo GROUP BY más
    // adelante si hiciera falta.
    const tendencia: { anio: number; mes: number; etiqueta: string; ingresos: number; gastos: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const fechaRef = new Date(anio, mes - 1 - i, 1);
      const a = fechaRef.getFullYear();
      const m = fechaRef.getMonth() + 1;
      const { inicio, fin } = rangoDelMes(a, m);
      const [movs, pagos] = await Promise.all([
        this.movimientosRepo.find({ where: { fecha: Between(inicio, fin) } }),
        this.pagosRepo.find({ where: { fecha: Between(inicio, fin) } }),
      ]);
      tendencia.push({
        anio: a,
        mes: m,
        etiqueta: fechaRef.toLocaleDateString('es-DO', { month: 'short', year: '2-digit' }),
        ingresos: sumar(movs.filter((x) => x.tipo === TipoMovimientoFinanciero.INGRESO)) + sumarPagos(pagos),
        gastos: sumar(movs.filter((x) => x.tipo === TipoMovimientoFinanciero.GASTO)),
      });
    }

    return {
      anio,
      mes,
      totalIngresos,
      totalGastos,
      balance: totalIngresos - totalGastos,
      porCategoria,
      tendencia,
    };
  }
}
