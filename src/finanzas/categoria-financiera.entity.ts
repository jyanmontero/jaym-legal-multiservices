import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
import { TipoMovimientoFinanciero } from '../common/enums/index.js';

/**
 * Categoría de ingreso o gasto general de la firma -- módulo "Control de
 * Gastos" (finanzas propias de JAYM Legal: nómina, alquiler, marketing,
 * honorarios cobrados, etc.). Distinto de Gasto (facturacion/gasto.entity.ts),
 * que es el costo de UN expediente específico, y distinto de Cotizacion/
 * Factura, que son lo que se le cobra al cliente. Cada categoría de gasto
 * puede llevar un presupuesto mensual de referencia para el semáforo del
 * Panel (verde/amarillo/rojo según % usado).
 */
@Entity('categorias_financieras')
@Index(['tipo'])
export class CategoriaFinanciera {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nombre: string;

  @Column({ type: 'enum', enum: TipoMovimientoFinanciero })
  tipo: TipoMovimientoFinanciero;

  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  presupuestoMensual?: string;

  // Las categorías no se eliminan físicamente (evita romper movimientos ya
  // registrados que la referencian) -- se desactivan y dejan de aparecer
  // como opción al crear un nuevo movimiento.
  @Column({ default: true })
  activa: boolean;

  @CreateDateColumn()
  creadoEn: Date;
}
