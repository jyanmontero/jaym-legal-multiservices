import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import type { RedSocial } from './ficha-marca.js';

export type EstadoPublicacionRedes =
  | 'borrador'
  | 'pendiente_aprobacion'
  | 'programada'
  | 'publicando'
  | 'publicada'
  | 'parcial'
  | 'fallida';

export type EstadoRed = 'publicada' | 'fallida' | 'manual_pendiente' | 'manual_hecha';

export interface ResultadoRed {
  estado: EstadoRed;
  /** Enlace a la publicación cuando la red lo devuelve (o el que pegue Joseph). */
  enlace?: string;
  /** ID de la publicación en la red. */
  idExterno?: string;
  /** Motivo del fallo o instrucción cuando queda pendiente a mano. */
  mensaje?: string;
  en?: string;
}

/**
 * Publicación del Community Manager: un mismo mensaje adaptado a cada red.
 * Flujo: la IA propone (pendiente_aprobacion) -> Joseph revisa/edita y
 * aprueba (programada o publicar ahora) -> el sistema publica en las redes
 * conectadas y deja listas para copiar las demás. Nada sale sin la
 * aprobación explícita de Joseph (aprobadoPorId).
 */
@Entity('publicaciones_redes')
export class PublicacionRedes {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  titulo: string;

  @Column({ type: 'text', nullable: true })
  tema?: string;

  // { facebook: '...', instagram: '...', ... } -- solo las redes elegidas.
  @Column({ type: 'jsonb', default: () => "'{}'" })
  textos: Partial<Record<RedSocial, string>>;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  redes: RedSocial[];

  // Clave en Cloudflare R2 de la imagen (puede ser la misma del blog).
  @Column({ nullable: true })
  imagenClave?: string;

  // Enlace que acompaña el mensaje (por ejemplo, el artículo del blog).
  @Column({ nullable: true })
  enlaceDestino?: string;

  @Column({ nullable: true })
  blogPostId?: string;

  @Column({ type: 'varchar', default: 'borrador' })
  @Index()
  estado: EstadoPublicacionRedes;

  @Column({ type: 'timestamptz', nullable: true })
  fechaProgramada?: Date;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  resultados: Partial<Record<RedSocial, ResultadoRed>>;

  @Column({ nullable: true })
  aprobadoPorId?: string;

  @Column({ type: 'timestamptz', nullable: true })
  aprobadoEn?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  publicadoEn?: Date;

  // Usuario que la pidió o creó (las propuestas de la IA se generan a su solicitud).
  @Column()
  creadoPorId: string;

  @CreateDateColumn()
  creadoEn: Date;

  @UpdateDateColumn()
  actualizadoEn: Date;
}
