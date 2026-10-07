import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * Bitácora de accesos a documentos (visualización y descarga). Solo se
 * inserta, nunca se modifica ni se borra: sirve de auditoría para saber
 * quién abrió o bajó cada archivo, sobre todo los confidenciales.
 */
@Entity('documento_accesos')
@Index(['documentoId'])
@Index(['usuarioId'])
export class DocumentoAcceso {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  documentoId: string;

  @Column()
  usuarioId: string;

  // 'ver' (visor en la plataforma) | 'descargar'
  @Column()
  accion: string;

  @Column({ type: 'varchar', nullable: true })
  ip?: string | null;

  @CreateDateColumn()
  creadoEn: Date;
}
