import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export enum EstadoCompra {
  CONFIRMADA = 'confirmada',
  ANULADA = 'anulada',
}

export enum OrigenCompra {
  MANUAL = 'manual',
  LECTURA_IA = 'lectura_ia', // el sistema leyó la foto/PDF y una persona revisó y confirmó
}

/**
 * Factura de gasto (compra) con valor fiscal: la que respalda lo que la firma
 * paga a proveedores y alimenta el formato 606 y el ITBIS adelantable.
 * Distinta de Gasto (costo de UN expediente) y de MovimientoFinanciero (Control
 * de Gastos interno): esta lleva NCF, RNC del proveedor y desglose de ITBIS.
 *
 * Nunca se edita ni se borra: si hay un error se anula (con motivo) y se
 * registra de nuevo. Cada alta y cada anulación queda en
 * compras_fiscales_historial (solo se agrega).
 */
@Entity('compras_fiscales')
@Index(['fechaComprobante'])
// Un mismo comprobante (proveedor + NCF) no puede estar dos veces vigente: la base
// de datos lo garantiza aunque dos personas lo registren al mismo tiempo.
@Index('idx_compra_proveedor_ncf_vigente', ['proveedorIdentificacion', 'ncf'], {
  unique: true,
  where: `"estado" = 'confirmada'`,
})
@Index(['archivoSha256'])
export class Compra {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  proveedorNombre: string;

  /** Solo dígitos: RNC (9) o cédula (11). */
  @Column()
  proveedorIdentificacion: string;

  /** 1 = RNC, 2 = Cédula (códigos del 606). */
  @Column('smallint')
  tipoIdentificacion: number;

  /** NCF o e-NCF normalizado (mayúsculas, sin guiones). */
  @Column()
  ncf: string;

  @Column({ type: 'varchar', nullable: true })
  ncfModificado?: string | null;

  @Column({ type: 'date' })
  fechaComprobante: string;

  @Column({ type: 'date', nullable: true })
  fechaPago?: string | null;

  /** Código 1 a 11 del 606 ("Tipo de Bienes y Servicios Comprados"). */
  @Column('smallint')
  tipoBienesServicios: number;

  /** Código 1 a 7 del 606 ("Forma de Pago"). */
  @Column('smallint', { default: 2 })
  formaPago: number;

  @Column('decimal', { precision: 14, scale: 2, default: 0 })
  montoServicios: string;

  @Column('decimal', { precision: 14, scale: 2, default: 0 })
  montoBienes: string;

  @Column('decimal', { precision: 14, scale: 2, default: 0 })
  itbisFacturado: string;

  /** Parte del ITBIS que no se adelanta y va al costo/gasto. */
  @Column('decimal', { precision: 14, scale: 2, default: 0 })
  itbisAlCosto: string;

  @Column('decimal', { precision: 14, scale: 2, default: 0 })
  itbisRetenido: string;

  @Column({ type: 'smallint', nullable: true })
  tipoRetencionIsr?: number | null;

  @Column('decimal', { precision: 14, scale: 2, default: 0 })
  retencionRenta: string;

  @Column('decimal', { precision: 14, scale: 2, default: 0 })
  isc: string;

  @Column('decimal', { precision: 14, scale: 2, default: 0 })
  otrosImpuestos: string;

  @Column('decimal', { precision: 14, scale: 2, default: 0 })
  propinaLegal: string;

  /** Total del comprobante (servicios + bienes + ITBIS + otros). */
  @Column('decimal', { precision: 14, scale: 2 })
  total: string;

  @Column({ default: 'DOP' })
  moneda: string;

  @Column('text', { nullable: true })
  concepto?: string;

  /** Si el gasto es de un caso, para el reporte de gastos por expediente. */
  @Column({ type: 'varchar', nullable: true })
  expedienteId?: string | null;

  @Column({ type: 'enum', enum: OrigenCompra, default: OrigenCompra.MANUAL })
  origen: OrigenCompra;

  // Archivo original (foto o PDF), guardado con nombre UUID en el
  // almacenamiento de documentos.
  @Column({ type: 'varchar', nullable: true })
  archivoClave?: string | null;

  @Column({ type: 'varchar', nullable: true })
  archivoNombreOriginal?: string | null;

  @Column({ type: 'varchar', nullable: true })
  archivoMime?: string | null;

  @Column({ type: 'varchar', nullable: true })
  archivoSha256?: string | null;

  @Column({ type: 'enum', enum: EstadoCompra, default: EstadoCompra.CONFIRMADA })
  estado: EstadoCompra;

  @Column({ type: 'text', nullable: true })
  motivoAnulacion?: string | null;

  @Column({ type: 'timestamp', nullable: true })
  anuladaEn?: Date | null;

  @Column({ type: 'varchar', nullable: true })
  anuladaPorId?: string | null;

  @Column()
  registradaPorId: string;

  @CreateDateColumn()
  creadoEn: Date;
}
