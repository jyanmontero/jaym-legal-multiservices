import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { MateriaJuridica } from '../common/enums/index.js';

/** Servicio jurídico del catálogo (ej. Divorcio por mutuo consentimiento). */
@Entity('servicios_catalogo')
export class ServicioCatalogo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  codigo: string;

  /** Nombre del área (ej. «Derecho de Familia») para agrupar en pantalla. */
  @Column()
  area: string;

  @Column({ type: 'enum', enum: MateriaJuridica })
  materia: MateriaJuridica;

  @Column()
  nombre: string;

  /** [{ texto, estado: 'verificada' | 'por_validar' }] */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  baseLegal: { texto: string; estado: string }[];

  @Column('text', { nullable: true })
  competencia?: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  etapas: string[];

  /** Claves de las preguntas de perfil que se le hacen al abogado para este servicio. */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  preguntas: string[];

  @Column({ default: true })
  activo: boolean;

  @Column('int', { default: 1 })
  version: number;

  @CreateDateColumn()
  creadoEn: Date;

  @UpdateDateColumn()
  actualizadoEn: Date;
}
