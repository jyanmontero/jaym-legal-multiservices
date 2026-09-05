import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Bitácora de seguimiento de un expediente -- notas de avance en lenguaje
 * libre que el abogado responsable (o quien tenga acceso) va dejando desde
 * que se abre el caso hasta su cierre ("hoy se depositó la demanda",
 * "el tribunal fijó audiencia para el...", etc). Es distinto del
 * HistorialExpediente (auditoría automática de qué campos cambiaron): esto
 * es contenido que la persona escribe a mano, pensado para leerse como una
 * línea de tiempo del caso.
 *
 * Al igual que el historial de cambios, esta tabla solo recibe INSERT --
 * no se expone edición ni borrado, para que la bitácora sea un registro
 * confiable de lo que se reportó y cuándo.
 */
@Entity('seguimiento_expediente')
@Index(['expedienteId', 'creadoEn'])
export class SeguimientoExpediente {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  expedienteId: string;

  @Column()
  usuarioId: string;

  @Column('text')
  texto: string;

  // Marca entradas que representan un hito importante del caso (una
  // decisión, un depósito, el cierre) para poder resaltarlas en la línea
  // de tiempo sin depender de que el texto las mencione.
  @Column({ default: false })
  hito: boolean;

  @CreateDateColumn()
  creadoEn: Date;
}
