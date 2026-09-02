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
}
