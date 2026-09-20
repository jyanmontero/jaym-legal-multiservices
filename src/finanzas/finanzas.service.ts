import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { CategoriaFinanciera } from './categoria-financiera.entity.js';
import { MovimientoFinanciero } from './movimiento-financiero.entity.js';
import { CreateCategoriaFinancieraDto, UpdateCategoriaFinancieraDto } from './dto/categoria-financiera.dto.js';
import { CreateMovimientoFinancieroDto } from './dto/movimiento-financiero.dto.js';
import { TipoMovimientoFinanciero } from '../common/enums/index.js';

function sumar(movimientos: MovimientoFinanciero[]): number {
  return movimientos.reduce((acc, m) => acc + Number(m.monto), 0);
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

  listarMovimientos(filtros: {
    tipo?: TipoMovimientoFinanciero;
    categoriaId?: string;
    desde?: string;
    hasta?: string;
  }) {
    const where: Record<string, unknown> = {};
    if (filtros.tipo) where.tipo = filtros.tipo;
    if (filtros.categoriaId) where.categoriaId = filtros.categoriaId;
    if (filtros.desde && filtros.hasta) where.fecha = Between(filtros.desde, filtros.hasta);
    return this.movimientosRepo.find({ where, order: { fecha: 'DESC', creadoEn: 'DESC' } });
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
    const movimientosMes = await this.movimientosRepo.find({ where: { fecha: Between(inicioMes, finMes) } });

    const totalIngresos = sumar(movimientosMes.filter((m) => m.tipo === TipoMovimientoFinanciero.INGRESO));
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
      const movs = await this.movimientosRepo.find({ where: { fecha: Between(inicio, fin) } });
      tendencia.push({
        anio: a,
        mes: m,
        etiqueta: fechaRef.toLocaleDateString('es-DO', { month: 'short', year: '2-digit' }),
        ingresos: sumar(movs.filter((x) => x.tipo === TipoMovimientoFinanciero.INGRESO)),
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
