import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Gasto de un expediente -- sección 11 del requerimiento ("Gastos del
 * expediente") y sección 17 (reporte "Gastos por expediente" /
 * "Rentabilidad por servicio"). Es dinero que la firma adelanta o incurre
 * por el caso (copias, timbres, alguacil, traducciones, etc.), distinto de
 * los honorarios que se cobran al cliente -- por eso vive separado de
 * ItemFacturable en vez de mezclarse con las líneas de factura.
 */
@Entity('gastos')
@Index(['expedienteId'])
export class Gasto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  expedienteId: string;

  @Column()
  concepto: string;

  @Column('decimal', { precision: 12, scale: 2 })
  monto: string;

  @Column({ type: 'date' })
  fecha: string;

  // Si el gasto ya se le trasladó al cliente en una factura/cotización
  // (reembolsable) -- solo informativo por ahora, no automatiza nada.
  @Column({ default: false })
  facturadoAlCliente: boolean;

  @Column('text', { nullable: true })
  notas?: string;

  @Column()
  registradoPorId: string;

  @CreateDateColumn()
  creadoEn: Date;
}
