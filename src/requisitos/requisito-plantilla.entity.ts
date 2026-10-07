import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { MateriaJuridica } from '../common/enums/index.js';

/**
 * Plantilla de requisitos configurable por materia jurídica (y
 * opcionalmente por tipo de servicio más específico) — sección 8 del
 * requerimiento. El administrador la mantiene desde configuración; al
 * crear un expediente, sus filas activas se copian a ExpedienteRequisito.
 */
@Entity('requisitos_plantilla')
export class RequisitoPlantilla {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: MateriaJuridica })
  materia: MateriaJuridica;

  @Column({ nullable: true })
  tipoServicio?: string;

  @Column()
  nombreRequisito: string;

  @Column('text', { nullable: true })
  descripcion?: string;

  @Column({ default: true })
  obligatorio: boolean;

  @Column('int', { default: 0 })
  orden: number;

  @Column({ default: true })
  activo: boolean;

  // --- Catálogo por servicio (nulos/por defecto = comportamiento anterior) ---
  /** Identificador estable del catálogo (ej. familia.divorcio....01); único. */
  @Column({ type: 'varchar', nullable: true, unique: true })
  codigo?: string | null;

  /** Servicio al que pertenece; nulo = requisito base de la materia o general. */
  @Column({ type: 'varchar', nullable: true })
  servicioCodigo?: string | null;

  /** true = aplica a todo expediente creado desde un servicio del catálogo. */
  @Column({ default: false })
  general: boolean;

  @Column({ type: 'varchar', nullable: true })
  tipo?: string | null; // documento | dato | entregable | accion

  @Column({ type: 'varchar', nullable: true })
  categoriaDocumento?: string | null;

  @Column({ type: 'varchar', nullable: true })
  aporta?: string | null; // cliente | firma | tercero

  /** Clave de pregunta de perfil que debe ser verdadera; nulo = siempre aplica. */
  @Column({ type: 'varchar', nullable: true })
  condicion?: string | null;

  /** true = pendiente de visto bueno del abogado responsable. */
  @Column({ default: false })
  validar: boolean;

  @Column('text', { nullable: true })
  nota?: string | null;

  @Column({ type: 'timestamp', nullable: true })
  aprobadoEn?: Date | null;

  @Column({ type: 'varchar', nullable: true })
  aprobadoPorId?: string | null;
}
