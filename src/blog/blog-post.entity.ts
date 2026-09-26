import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { EstadoBlogPost, MateriaJuridica } from '../common/enums/index.js';

/**
 * Entrada de blog para jaymlegalmultiservices.com (sitio de marketing de
 * JAYM Legal, WordPress con tema Hello Elementor). Se escribe una sola vez
 * aquí en el sistema y se publica sola en la fecha que Joseph le asigne --
 * nunca hay que copiar/pegar nada en el WordPress.
 *
 * Flujo de estados: borrador -> programado (tiene fechaProgramada) ->
 * publicado (ya salió en el sitio) ó fallido (el cron intentó publicarlo en
 * su fecha y WordPress lo rechazó -- ver motivoFallo). Un blog fallido se
 * puede corregir y volver a programar.
 */
@Entity('blog_posts')
export class BlogPost {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  titulo: string;

  // Contenido en HTML (el editor de texto enriquecido del frontend produce
  // HTML directamente) -- se envía tal cual al campo `content` de WordPress.
  @Column({ type: 'text', default: '' })
  contenidoHtml: string;

  // Resumen corto para el campo `excerpt` de WordPress y para la vista de
  // calendario del sistema. Opcional -- si no se da, WordPress genera uno
  // automáticamente a partir del contenido.
  @Column({ type: 'text', nullable: true })
  extracto?: string;

  // Área de práctica -- se usa como categoría de WordPress (se crea sola si
  // no existe) para que el blog quede organizado por temas, a diferencia de
  // las 4 entradas existentes que están todas en "Uncategorized".
  @Column({ type: 'enum', enum: MateriaJuridica, nullable: true })
  areaPractica?: MateriaJuridica;

  // Palabra clave / tema que se le dio a la IA para redactar el borrador
  // (o que Joseph escribió a mano como referencia) -- se conserva para
  // poder regenerar o dar seguimiento a la estrategia de SEO.
  @Column({ type: 'text', nullable: true })
  temaOriginal?: string;

  // Clave de almacenamiento (Cloudflare R2) de la imagen destacada, igual
  // patrón que las fotos de Marketing Inmobiliario.
  @Column({ nullable: true })
  imagenDestacadaClave?: string;

  @Column({ type: 'date', nullable: true })
  fechaProgramada?: string;

  @Column({ type: 'enum', enum: EstadoBlogPost, default: EstadoBlogPost.BORRADOR })
  @Index()
  estado: EstadoBlogPost;

  @Column({ type: 'int', nullable: true })
  wordpressPostId?: number;

  @Column({ nullable: true })
  wordpressEnlace?: string;

  @Column({ type: 'timestamptz', nullable: true })
  publicadoEn?: Date;

  // Si el cron intentó publicar y WordPress lo rechazó, queda aquí el motivo
  // para que Joseph sepa qué corregir antes de reprogramarlo.
  @Column({ type: 'text', nullable: true })
  motivoFallo?: string;

  @Index()
  @Column()
  creadoPorId: string;

  @CreateDateColumn()
  creadoEn: Date;

  @UpdateDateColumn()
  actualizadoEn: Date;
}
