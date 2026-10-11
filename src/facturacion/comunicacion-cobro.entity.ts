import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export type TipoComunicacionCobro = 'cotizacion' | 'factura' | 'recordatorio';
export type CanalComunicacionCobro = 'correo' | 'whatsapp';
export type EstadoComunicacionCobro = 'enviado' | 'fallido' | 'abierto';

/**
 * Constancia de cada cotización, factura o recordatorio enviado al cliente
 * (o preparado en WhatsApp). Solo se agrega: nunca se edita ni se borra.
 * Estado "abierto" = se abrió WhatsApp con el mensaje listo; el sistema no
 * puede saber si la persona terminó de enviarlo.
 */
@Entity('comunicaciones_cobro')
export class ComunicacionCobro {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  tipo: TipoComunicacionCobro;

  @Column({ type: 'varchar' })
  canal: CanalComunicacionCobro;

  @Column({ type: 'varchar' })
  clienteId: string;

  @Column({ type: 'varchar', nullable: true })
  expedienteId?: string;

  @Column({ type: 'varchar', nullable: true })
  facturaId?: string;

  @Column({ type: 'varchar', nullable: true })
  cotizacionId?: string;

  @Column({ type: 'varchar' })
  destinatario: string;

  @Column({ type: 'varchar', nullable: true })
  asunto?: string;

  @Column('text')
  contenido: string;

  @Column({ type: 'varchar', nullable: true })
  adjunto?: string;

  @Column({ type: 'varchar' })
  estado: EstadoComunicacionCobro;

  @Column('text', { nullable: true })
  error?: string;

  @Column({ type: 'varchar', nullable: true })
  enviadoPorId?: string;

  @CreateDateColumn()
  creadoEn: Date;
}
