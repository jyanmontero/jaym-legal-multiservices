import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Historial de expediente — sección 7 del requerimiento.
 *
 * REGLA OBLIGATORIA: esta tabla solo recibe INSERT. Nunca UPDATE ni DELETE.
 * No se expone ningún método de actualización o borrado en el repositorio
 * (ver HistorialService) — es una restricción de la aplicación, no solo
 * una convención.
 */
@Entity('historial_expediente')
@Index(['expedienteId', 'creadoEn'])
export class HistorialExpediente {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  expedienteId: string;

  @Column('jsonb')
  snapshotAnterior: Record<string, any>;

  @Column('jsonb')
  snapshotNuevo: Record<string, any>;

  @Column('text', { array: true })
  camposModificados: string[];

  @Column()
  usuarioId: string;

  @Column('text', { nullable: true })
  motivo?: string;

  @Column({ nullable: true })
  ipDispositivo?: string;

  @Column({ default: false })
  esRestauracion: boolean;

  @CreateDateColumn()
  creadoEn: Date;
}
