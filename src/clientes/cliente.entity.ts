import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { TipoCliente, EstadoCliente, EstadoCivil } from '../common/enums/index.js';

/**
 * Cliente (persona física o jurídica) — sección 4 del requerimiento.
 *
 * Los índices únicos parciales sobre cedula, pasaporte, rnc y correo son la
 * base de la detección de duplicados: se aplican a nivel de base de datos
 * (ver migración) y no solo en la lógica de la aplicación.
 */
@Entity('clientes')
export class Cliente {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: TipoCliente })
  tipo: TipoCliente;

  @Column({ unique: true })
  codigoCliente: string; // ej. CL-0104

  // --- Persona física ---
  @Column({ nullable: true })
  nombres?: string;

  @Column({ nullable: true })
  apellidos?: string;

  @Column({ type: 'date', nullable: true })
  fechaNacimiento?: string;

  @Column({ type: 'enum', enum: EstadoCivil, nullable: true })
  estadoCivil?: EstadoCivil;

  @Column({ nullable: true })
  ocupacion?: string;

  // --- Persona jurídica ---
  @Column({ nullable: true })
  razonSocial?: string;

  @Column({ nullable: true })
  nombreComercial?: string;

  @Column({ nullable: true })
  registroMercantil?: string;

  @Column({ nullable: true })
  domicilioSocial?: string;

  @Column({ nullable: true })
  representanteLegal?: string;

  @Column({ nullable: true })
  cedulaOPasaporteRepresentante?: string;

  @Column({ nullable: true })
  actividadComercial?: string;

  // --- Identificación (compartidos, con índice único parcial) ---
  @Index('idx_cliente_cedula_unica', { unique: true, where: '"cedula" IS NOT NULL' })
  @Column({ nullable: true })
  cedula?: string;

  @Index('idx_cliente_pasaporte_unico', { unique: true, where: '"pasaporte" IS NOT NULL' })
  @Column({ nullable: true })
  pasaporte?: string;

  @Index('idx_cliente_rnc_unico', { unique: true, where: '"rnc" IS NOT NULL' })
  @Column({ nullable: true })
  rnc?: string;

  @Column()
  nacionalidad: string;

  @Column()
  direccion: string;

  @Column('text', { array: true, default: () => "'{}'" })
  telefonos: string[];

  @Index('idx_cliente_correo_unico', { unique: true, where: '"correo" IS NOT NULL' })
  @Column({ nullable: true })
  correo?: string;

  @Column({ nullable: true })
  personaContacto?: string;

  @Column('text', { nullable: true })
  observaciones?: string;

  @Column({ type: 'enum', enum: EstadoCliente, default: EstadoCliente.PROSPECTO })
  estado: EstadoCliente;

  @Column({ nullable: true })
  creadoPorId?: string;

  @CreateDateColumn()
  creadoEn: Date;

  @UpdateDateColumn()
  actualizadoEn: Date;
}
