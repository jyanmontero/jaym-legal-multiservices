import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { EstadoSolicitudDocumento } from '../common/enums/index.js';

/**
 * Una solicitud de documento representa el ciclo de vida de UN documento
 * generado a partir de una plantilla (ver plantillas-catalogo.ts):
 *
 *   pendiente_cliente -> (el cliente llena el formulario público) ->
 *   pendiente_aprobacion -> (el despacho revisa) ->
 *     aprobado (se genera el PDF final)
 *     o de vuelta a pendiente_cliente (se piden correcciones, con motivoRechazo)
 *
 * `expedienteId`/`clienteId` son columnas indexadas simples (igual que en
 * Cotizacion/Factura), no relaciones @ManyToOne -- no hay integridad
 * referencial a nivel de base de datos, a propósito, para no complicar el
 * borrado de expedientes/clientes más adelante.
 */
@Entity('solicitudes_documento')
@Index(['expedienteId'])
@Index(['clienteId'])
export class SolicitudDocumento {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  plantillaClave: string;

  @Column({ nullable: true })
  expedienteId?: string;

  @Column({ nullable: true })
  clienteId?: string;

  @Column({
    type: 'enum',
    enum: EstadoSolicitudDocumento,
    default: EstadoSolicitudDocumento.PENDIENTE_CLIENTE,
  })
  estado: EstadoSolicitudDocumento;

  // Valores capturados por campo de la plantilla (clave -> valor). Se
  // guarda como jsonb porque cada plantilla tiene un conjunto de campos
  // distinto -- no tiene sentido modelarlo como columnas fijas.
  @Column('jsonb', { default: () => "'{}'" })
  datos: Record<string, string>;

  // Token de acceso público (largo y aleatorio) -- es la única credencial
  // que necesita el cliente para abrir el formulario y llenarlo, sin
  // necesidad de una cuenta en JAYM LEGAL.
  @Index('idx_solicitud_documento_token_unico', { unique: true })
  @Column()
  tokenAcceso: string;

  // Nullable: una solicitud puede originarse en el catálogo público de
  // autoservicio (nadie del despacho la creó), no solo desde la pantalla
  // interna.
  @Column({ nullable: true })
  creadoPorId?: string;

  // Precio copiado del catálogo al momento de crear la solicitud (ver nota
  // en plantillas-catalogo.ts). RD$.
  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  precio: string;

  @Column({ default: false })
  pagoConfirmado: boolean;

  @Column({ type: 'timestamp', nullable: true })
  pagoConfirmadoEn?: Date;

  @Column({ nullable: true })
  pagoConfirmadoPorId?: string;

  @Column({ nullable: true })
  referenciaPago?: string;

  @Column('text', { nullable: true })
  notasInternas?: string;

  // Nullable explícito (no solo opcional) porque el flujo de "pedir
  // correcciones" necesita poder LIMPIAR este campo al aprobar -- TypeORM
  // trata `undefined` como "no tocar la columna", no como NULL.
  @Column('text', { nullable: true })
  motivoRechazo?: string | null;

  @Column({ nullable: true })
  documentoGeneradoId?: string;

  // Confirmación explícita de que un humano (no la IA) verificó que cada
  // ley y jurisprudencia citada en el documento existe y es correcta.
  // Obligatoria antes de aprobar cuando la plantilla tiene
  // requiereVerificacionCitas=true (ver plantillas-catalogo.ts) -- sin
  // importar si el texto lo escribió el abogado a mano o partió de un
  // borrador generado por el asistente de IA.
  @Column({ default: false })
  citasVerificadas: boolean;

  @Column({ nullable: true })
  citasVerificadasPorId?: string;

  @Column({ type: 'timestamp', nullable: true })
  citasVerificadasEn?: Date;

  @Column({ nullable: true })
  revisadoPorId?: string;

  @Column({ type: 'timestamp', nullable: true })
  completadoEn?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  revisadoEn?: Date;

  @CreateDateColumn()
  creadoEn: Date;

  @UpdateDateColumn()
  actualizadoEn: Date;
}
