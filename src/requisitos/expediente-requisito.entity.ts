import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { EstadoRequisito } from '../common/enums/index.js';

/**
 * Instancia real de un requisito dentro de un expediente concreto —
 * sección 8. Se crea copiando `requisitos_plantilla` al abrir el
 * expediente, pero también admite requisitos manuales únicos
 * (requisitoPlantillaId nulo).
 */
@Entity('expediente_requisitos')
@Index(['expedienteId'])
export class ExpedienteRequisito {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  expedienteId: string;

  @Column({ nullable: true })
  requisitoPlantillaId?: string;

  // Copiado al momento de creación — si la plantilla cambia después, este
  // expediente conserva el texto que tenía cuando se generó su checklist.
  @Column()
  nombreRequisito: string;

  @Column('text', { nullable: true })
  descripcion?: string;

  @Column({ default: true })
  obligatorio: boolean;

  @Column('int', { default: 0 })
  orden: number;

  @Column({ type: 'enum', enum: EstadoRequisito, default: EstadoRequisito.PENDIENTE })
  estado: EstadoRequisito;

  @Column({ nullable: true })
  responsableId?: string;

  @Column({ type: 'date', nullable: true })
  fechaPrometida?: string;

  @Column({ type: 'date', nullable: true })
  fechaCompletado?: string;

  @Column({ nullable: true })
  documentoId?: string;

  @Column('text', { nullable: true })
  observaciones?: string;

  @CreateDateColumn()
  creadoEn: Date;
}
