import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';

/**
 * Asignación de un colaborador a un expediente -- es la ÚNICA fuente de
 * verdad de qué expedientes puede ver un colaborador (ver
 * ColaboradoresPortalService). Un colaborador sin ninguna fila aquí no ve
 * ningún expediente. Tabla de unión propia (en vez de una columna en
 * Expediente) porque un mismo expediente puede tener varios colaboradores
 * asignados y viceversa.
 */
@Entity('colaboradores_expedientes')
@Unique('UQ_colaborador_expediente', ['colaboradorId', 'expedienteId'])
@Index(['expedienteId'])
export class ColaboradorExpediente {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  colaboradorId: string;

  @Column()
  expedienteId: string;

  @Column({ nullable: true })
  notas?: string;

  @Column()
  asignadoPorId: string;

  @CreateDateColumn()
  asignadoEn: Date;
}
