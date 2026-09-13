import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Factura } from './factura.entity.js';
import { MetodoPago } from '../common/enums/index.js';

@Entity('pagos')
export class Pago {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Factura, { eager: false })
  @JoinColumn({ name: 'facturaId' })
  factura: Factura;

  @Column()
  facturaId: string;

  @Column('decimal', { precision: 12, scale: 2 })
  monto: string;

  @Column({ type: 'enum', enum: MetodoPago })
  metodo: MetodoPago;

  @Column({ nullable: true })
  referencia?: string;

  @Column({ type: 'date' })
  fecha: string;

  @Column('text', { nullable: true })
  notas?: string;

  @Column({ nullable: true })
  registradoPorId?: string;

  @CreateDateColumn()
  creadoEn: Date;
}
