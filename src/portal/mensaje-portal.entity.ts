import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * Mensaje del hilo cliente <-> firma dentro del Portal del Cliente --
 * sección 16 ("Enviar mensajes"). Deliberadamente simple: un hilo plano
 * por expediente (o general, si expedienteId es nulo), sin adjuntos por
 * ahora -- para eso ya existe la subida de documentos del portal.
 */
@Entity('mensajes_portal')
@Index(['clienteId', 'expedienteId', 'creadoEn'])
export class MensajePortal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  clienteId: string;

  @Column({ nullable: true })
  expedienteId?: string;

  @Column({ type: 'varchar', length: 10 })
  remitenteTipo: 'cliente' | 'staff';

  // Id del PortalUsuario si remitenteTipo='cliente', o del Usuario interno
  // si remitenteTipo='staff'.
  @Column()
  remitenteId: string;

  @Column('text')
  contenido: string;

  @Column({ type: 'timestamp', nullable: true })
  leidoEn?: Date;

  @CreateDateColumn()
  creadoEn: Date;
}
