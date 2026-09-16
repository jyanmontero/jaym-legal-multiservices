import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Gasto } from './gasto.entity.js';
import { CreateGastoDto } from './dto/gasto.dto.js';

@Injectable()
export class GastosService {
  constructor(
    @InjectRepository(Gasto)
    private readonly gastoRepo: Repository<Gasto>,
  ) {}

  async crear(dto: CreateGastoDto, usuarioId: string): Promise<Gasto> {
    const gasto = this.gastoRepo.create({
      ...dto,
      monto: dto.monto.toFixed(2),
      fecha: dto.fecha ?? new Date().toISOString().slice(0, 10),
      registradoPorId: usuarioId,
    });
    return this.gastoRepo.save(gasto);
  }

  async listar(expedienteId?: string): Promise<Gasto[]> {
    return this.gastoRepo.find({
      where: expedienteId ? { expedienteId } : {},
      order: { fecha: 'DESC', creadoEn: 'DESC' },
    });
  }

  async eliminar(id: string): Promise<void> {
    const gasto = await this.gastoRepo.findOne({ where: { id } });
    if (!gasto) throw new NotFoundException('Gasto no encontrado');
    await this.gastoRepo.delete(id);
  }

  /** Suma total de gastos por expediente, para el módulo de Reportes. */
  async totalesPorExpediente(desde?: string, hasta?: string): Promise<Map<string, number>> {
    const qb = this.gastoRepo
      .createQueryBuilder('g')
      .select('g.expedienteId', 'expedienteId')
      .addSelect('SUM(g.monto)', 'total')
      .groupBy('g.expedienteId');
    if (desde) qb.andWhere('g.fecha >= :desde', { desde });
    if (hasta) qb.andWhere('g.fecha <= :hasta', { hasta });
    const filas = await qb.getRawMany<{ expedienteId: string; total: string }>();
    return new Map(filas.map((f) => [f.expedienteId, Number(f.total)]));
  }
}
