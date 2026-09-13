import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { TipoEventoAgenda, EstadoEventoAgenda, NivelPrioridad } from '../common/enums/index.js';

/**
 * Evento de agenda — sección 9 del requerimiento. Cubre audiencias, citas,
 * reuniones, depósitos, seguimientos, vencimientos, llamadas, tareas
 * internas y plazos judiciales/administrativos.
 */
@Entity('agenda_eventos')
@Index(['fechaHoraInicio'])
@Index(['responsableId'])
export class AgendaEvento {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: TipoEventoAgenda })
  tipo: TipoEventoAgenda;

  @Column()
  titulo: string;

  @Column({ nullable: true })
  expedienteId?: string;

  @Column({ nullable: true })
  clienteId?: string;

  @Column({ type: 'timestamp' })
  fechaHoraInicio: Date;

  @Column({ type: 'timestamp', nullable: true })
  fechaHoraFin?: Date;

  @Column()
  responsableId: string;

  @Column('text', { array: true, default: () => "'{}'" })
  colaboradores: string[];

  @Column({ type: 'enum', enum: NivelPrioridad, default: NivelPrioridad.MEDIA })
  prioridad: NivelPrioridad;

  @Column({ type: 'enum', enum: EstadoEventoAgenda, default: EstadoEventoAgenda.PENDIENTE })
  estado: EstadoEventoAgenda;

  @Column('int', { nullable: true })
  recordatorioMinutosAntes?: number;

  // Evita reenviar el mismo recordatorio en cada corrida del cron (ver
  // AgendaScheduler). Se resetea a false cuando se reprograma la fecha o
  // se cambia recordatorioMinutosAntes -- ver AgendaService.actualizar().
  @Column({ default: false })
  recordatorioEnviado: boolean;

  @Column('text', { nullable: true })
  observaciones?: string;

  @Column()
  creadoPorId: string;

  // Id del evento correspondiente en Google Calendar, cuando la
  // integración está activa — permite editarlo/cancelarlo desde ahí en
  // vez de crear uno nuevo cada vez, y evita importarlo dos veces cuando
  // el mismo evento se creó originalmente en Google.
  @Index('idx_agenda_evento_google_unico', { unique: true, where: '"googleEventId" IS NOT NULL' })
  @Column({ nullable: true })
  googleEventId?: string;

  @CreateDateColumn()
  creadoEn: Date;

  @UpdateDateColumn()
  actualizadoEn: Date;
}
