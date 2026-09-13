import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Cliente } from '../clientes/cliente.entity.js';
import { Expediente } from '../expedientes/expediente.entity.js';
import { EstadoFactura } from '../common/enums/index.js';
import { ItemFacturable } from './item-facturable.js';

@Entity('facturas')
export class Factura {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  numero: string; // ej. FAC-2026-0001 — numeración interna, no es el NCF

  // Número de Comprobante Fiscal (o e-CF) emitido por la DGII. Se deja como
  // texto libre, opcional: la asignación real de comprobantes fiscales debe
  // coordinarse con el contador/proveedor autorizado de la firma — este
  // sistema NO genera NCF válidos por sí solo.
  @Column({ nullable: true })
  ncf?: string;

  @ManyToOne(() => Cliente, { eager: false })
  @JoinColumn({ name: 'clienteId' })
  cliente: Cliente;

  @Column()
  clienteId: string;

  @ManyToOne(() => Expediente, { eager: false, nullable: true })
  @JoinColumn({ name: 'expedienteId' })
  expediente?: Expediente;

  @Column({ nullable: true })
  expedienteId?: string;

  @Column({ nullable: true })
  cotizacionId?: string;

  @Column()
  concepto: string;

  @Column('jsonb')
  items: ItemFacturable[];

  @Column({ default: true })
  aplicaItbis: boolean;

  @Column('decimal', { precision: 12, scale: 2 })
  subtotal: string;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  descuento: string;

  @Column('decimal', { precision: 12, scale: 2 })
  itbis: string;

  @Column('decimal', { precision: 12, scale: 2 })
  total: string;

  // Suma de los pagos registrados — se recalcula en cada alta/baja de pago
  // (ver FacturacionService), nunca se edita manualmente.
  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  montoPagado: string;

  @Column({ type: 'enum', enum: EstadoFactura, default: EstadoFactura.PENDIENTE })
  estado: EstadoFactura;

  @Column({ type: 'date' })
  fechaEmision: string;

  @Column({ type: 'date', nullable: true })
  fechaVencimiento?: string;

  @Column('text', { nullable: true })
  notas?: string;

  // --- Campos estilo "factura comercial" (opcionales) --------------------
  @Column({ nullable: true })
  condicionesPago?: string; // ej. "Contado" o "Crédito a 30 días"

  @Column({ nullable: true })
  numeroOrdenCompra?: string;

  @Column({ nullable: true })
  vendedor?: string;

  @Column('text', { nullable: true })
  direccionFacturacion?: string;

  @Column('text', { nullable: true })
  direccionEnvio?: string;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  costoEnvio: string;

  @Column({ nullable: true })
  creadoPorId?: string;

  @CreateDateColumn()
  creadoEn: Date;

  @UpdateDateColumn()
  actualizadoEn: Date;
}
