import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Historial de cambios genérico — extiende a Facturas, Clientes y Usuarios
 * la misma idea que `historial_expediente` (sección 7), pero sin la
 * restauración de versiones (esa sigue siendo exclusiva de Expedientes, ver
 * `historial/` — este módulo es deliberadamente independiente de aquel para
 * no tocar código que ya funciona).
 *
 * REGLA OBLIGATORIA: esta tabla solo recibe INSERT. Nunca UPDATE ni DELETE
 * (ver HistorialCambiosService).
 */
export type TipoEntidadHistorial = 'cliente' | 'factura' | 'usuario';

@Entity('historial_cambios')
@Index(['entidadTipo', 'entidadId', 'creadoEn'])
export class HistorialCambio {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20 })
  entidadTipo: TipoEntidadHistorial;

  @Column()
  entidadId: string;

  @Column('jsonb')
  snapshotAnterior: Record<string, any>;

  @Column('jsonb')
  snapshotNuevo: Record<string, any>;

  @Column('text', { array: true })
  camposModificados: string[];

  @Column()
  usuarioId: string;

  @Column({ type: 'text', nullable: true })
  motivo?: string | null;

  @CreateDateColumn()
  creadoEn: Date;
}
