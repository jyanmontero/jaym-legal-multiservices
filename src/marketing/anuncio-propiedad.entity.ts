import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
import { EstadoAnuncioPropiedad } from '../common/enums/index.js';

/**
 * Anuncio de una propiedad de JAYM Portal Inmobiliario, generado a partir
 * de fotos + datos + precio, y publicado en Facebook/Instagram. Es un
 * negocio distinto de la gestión de casos legales -- no tiene relación con
 * Cliente/Expediente.
 */
@Entity('anuncios_propiedades')
export class AnuncioPropiedad {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  titulo: string;

  @Column({ nullable: true })
  zona?: string;

  @Column({ type: 'int', nullable: true })
  habitaciones?: number;

  @Column({ type: 'int', nullable: true })
  banos?: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  metrosCuadrados?: string;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  precio: string;

  @Column({ default: 'RD$' })
  moneda: string;

  @Column({ type: 'text', nullable: true })
  notas?: string;

  // Forma de contacto a incluir en el anuncio (WhatsApp, enlace del portal,
  // etc.) -- se deja libre porque todavía no hay una constante de marca
  // institucional para el Portal Inmobiliario (a diferencia de JAYM Legal).
  @Column({ type: 'text', nullable: true })
  contacto?: string;

  // Claves de almacenamiento (Cloudflare R2) de las fotos, en el orden en
  // que deben mostrarse en el anuncio.
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  fotosClaves: string[];

  // Texto del anuncio para Facebook/Instagram -- generado por IA, pero
  // siempre editable antes de publicar (igual criterio que el resto del
  // sistema: la IA propone, el humano revisa y confirma).
  @Column({ type: 'text', nullable: true })
  textoAnuncio?: string;

  // Mensaje listo para reenviar por WhatsApp (broadcast manual, no
  // automático -- ver README del módulo).
  @Column({ type: 'text', nullable: true })
  mensajeWhatsapp?: string;

  @Column({ type: 'enum', enum: EstadoAnuncioPropiedad, default: EstadoAnuncioPropiedad.BORRADOR })
  estado: EstadoAnuncioPropiedad;

  @Column({ nullable: true })
  facebookPostId?: string;

  @Column({ nullable: true })
  instagramMediaId?: string;

  @Column({ type: 'int', nullable: true })
  wordpressPostId?: number;

  @Column({ nullable: true })
  wordpressEnlace?: string;

  @Column({ type: 'timestamptz', nullable: true })
  publicadoEn?: Date;

  @Index()
  @Column()
  creadoPorId: string;

  @CreateDateColumn()
  creadoEn: Date;
}
