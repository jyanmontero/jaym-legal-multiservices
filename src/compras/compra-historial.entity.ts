import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * Registro de solo agregar de lo que ocurre con cada factura de gasto: alta y
 * anulación. No hay métodos de edición ni de borrado para esta tabla.
 */
@Entity('compras_fiscales_historial')
@Index(['compraId'])
export class CompraHistorial {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  compraId: string;

  @Column()
  accion: 'crear' | 'anular';

  /** Copia completa de la compra en ese momento. */
  @Column('jsonb')
  snapshot: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  motivo?: string | null;

  @Column()
  usuarioId: string;

  @CreateDateColumn()
  creadoEn: Date;
}
