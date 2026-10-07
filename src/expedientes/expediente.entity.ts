import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Cliente } from '../clientes/cliente.entity.js';
import {
  MateriaJuridica,
  EstadoExpediente,
  NivelPrioridad,
  NivelRiesgo,
} from '../common/enums/index.js';

@Entity('expedientes')
export class Expediente {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  codigo: string; // ej. JAYM-2026-CIV-0001

  @Column({ nullable: true })
  numeroJudicial?: string;

  @ManyToOne(() => Cliente, { eager: false })
  @JoinColumn({ name: 'clienteId' })
  cliente: Cliente;

  @Column()
  clienteId: string;

  @Column({ nullable: true })
  contraparte?: string;

  @Column({ type: 'uuid', nullable: true })
  abogadoResponsableId?: string | null;

  @Column({ type: 'enum', enum: MateriaJuridica })
  materia: MateriaJuridica;

  @Column({ nullable: true })
  tipoServicio?: string;

  /** Servicio del catálogo (servicios_catalogo.codigo) que define su checklist. */
  @Column({ type: 'varchar', nullable: true })
  servicioCodigo?: string | null;

  /** Respuestas a las preguntas de perfil del servicio (ej. { hijos_menores: true }). */
  @Column({ type: 'jsonb', default: () => "'{}'" })
  perfil: Record<string, boolean>;

  @Column('text', { nullable: true })
  descripcion?: string;

  @Column('text', { nullable: true })
  objetivo?: string;

  @Column({ nullable: true })
  tribunalInstitucion?: string;

  @Column({ type: 'date', nullable: true })
  fechaApertura?: string;

  @Column({ type: 'date', nullable: true })
  fechaDeposito?: string;

  @Column({ type: 'date', nullable: true })
  proximaActuacion?: string;

  @Column({ type: 'date', nullable: true })
  fechaLimite?: string;

  @Column({ type: 'enum', enum: NivelPrioridad, default: NivelPrioridad.MEDIA })
  prioridad: NivelPrioridad;

  @Column({ type: 'enum', enum: NivelRiesgo, default: NivelRiesgo.BAJO })
  riesgo: NivelRiesgo;

  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  honorariosAcordados?: string;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  balancePendiente: string;

  @Column({ type: 'enum', enum: EstadoExpediente, default: EstadoExpediente.PROSPECTO })
  estado: EstadoExpediente;

  @Column('text', { array: true, default: () => "'{}'" })
  etiquetas: string[];

  @CreateDateColumn()
  creadoEn: Date;

  @UpdateDateColumn()
  actualizadoEn: Date;
}
