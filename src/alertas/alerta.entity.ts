import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { TipoReglaAlerta, SeveridadAlerta } from '../common/enums/index.js';

/**
 * Alerta generada automáticamente por el motor de reglas — sección 14.
 * No se crea manualmente desde la interfaz; ver AlertasService.generarAlertas().
 */
@Entity('alertas')
@Index(['expedienteId'])
@Index(['resuelta'])
export class Alerta {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: TipoReglaAlerta })
  tipoRegla: TipoReglaAlerta;

  @Column({ type: 'enum', enum: SeveridadAlerta })
  severidad: SeveridadAlerta;

  @Column({ nullable: true })
  expedienteId?: string;

  @Column({ nullable: true })
  clienteId?: string;

  @Column({ nullable: true })
  documentoId?: string;

  @Column({ nullable: true })
  agendaEventoId?: string;

  @Column({ nullable: true })
  facturaId?: string;

  @Column('text')
  mensaje: string;

  // Nulo = visible para todo el que tenga acceso al expediente asociado.
  @Column({ nullable: true })
  usuarioDestinatarioId?: string;

  @Column({ default: false })
  vista: boolean;

  @Column({ type: 'timestamp', nullable: true })
  vistaEn?: Date;

  @Column({ default: false })
  resuelta: boolean;

  @Column({ type: 'timestamp', nullable: true })
  resueltaEn?: Date;

  @CreateDateColumn()
  creadoEn: Date;
}
