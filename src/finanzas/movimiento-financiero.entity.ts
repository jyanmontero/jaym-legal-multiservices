import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
import { TipoMovimientoFinanciero, MetodoPago } from '../common/enums/index.js';

/**
 * Ingreso o gasto general de la firma -- "Control de Gastos" del despacho
 * (sección 11 del requerimiento, ampliada con lo recomendado en la
 * herramienta de finanzas preparada para JAYM Legal: categorías con
 * presupuesto mensual, panel de balance y tendencia). No debe confundirse
 * con Gasto (facturacion/gasto.entity.ts), que es el costo de UN expediente
 * específico y sigue viviendo aparte.
 */
@Entity('movimientos_financieros')
@Index(['tipo', 'fecha'])
@Index(['categoriaId'])
export class MovimientoFinanciero {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: TipoMovimientoFinanciero })
  tipo: TipoMovimientoFinanciero;

  @Column()
  categoriaId: string;

  @Column()
  concepto: string;

  @Column('decimal', { precision: 12, scale: 2 })
  monto: string;

  @Column({ type: 'date' })
  fecha: string;

  @Column({ type: 'enum', enum: MetodoPago, nullable: true })
  metodoPago?: MetodoPago;

  @Column('text', { nullable: true })
  notas?: string;

  @Column()
  registradoPorId: string;

  @CreateDateColumn()
  creadoEn: Date;
}
