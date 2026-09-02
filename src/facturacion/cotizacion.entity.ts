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
import { EstadoCotizacion } from '../common/enums/index.js';
import { ItemFacturable } from './item-facturable.js';

/**
 * Cotización de trabajo legal para un cliente, opcionalmente vinculada a un
 * expediente ya abierto. Al aceptarse, se puede convertir en Factura
 * (ver FacturacionService.convertirCotizacionAFactura) sin volver a
 * escribir las líneas de trabajo.
 */
@Entity('cotizaciones')
export class Cotizacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  numero: string; // ej. COT-2026-0001

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

  @Column({ type: 'enum', enum: EstadoCotizacion, default: EstadoCotizacion.BORRADOR })
  estado: EstadoCotizacion;

  @Column({ type: 'date', nullable: true })
  validaHasta?: string;

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
