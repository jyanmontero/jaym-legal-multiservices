import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { CategoriaDocumento, EstadoCalidadDocumento } from '../common/enums/index.js';

/**
 * Documento — sección 12 del requerimiento.
 *
 * Versionado: subir una nueva versión del mismo documento NO sobrescribe
 * esta fila; crea una fila nueva con `documentoPadreId` apuntando a la
 * versión anterior. La versión "vigente" de un documento es aquella a la
 * que ninguna otra fila apunta como padre (ver DocumentosService.listar).
 *
 * Eliminación: `eliminadoEn` implementa la papelera recuperable — nunca se
 * hace DELETE real desde la interfaz.
 */
@Entity('documentos')
@Index(['expedienteId'])
@Index(['clienteId'])
export class Documento {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  expedienteId?: string;

  @Column({ nullable: true })
  clienteId?: string;

  @Column({ default: 'General' })
  carpeta: string;

  @Column({ type: 'enum', enum: CategoriaDocumento })
  categoria: CategoriaDocumento;

  @Column()
  nombreArchivo: string;

  @Column('text', { nullable: true })
  descripcion?: string;

  // Ruta relativa dentro del almacenamiento local (./storage/documentos/...)
  // en este MVP. Al pasar a producción, este campo pasa a contener la key
  // del objeto en S3/GCS en vez de una ruta de disco (ver arquitectura).
  @Column()
  rutaAlmacenamiento: string;

  @Column()
  tipoMime: string;

  @Column('int')
  tamanoBytes: number;

  @Column('int', { default: 1 })
  version: number;

  @Column('uuid', { nullable: true })
  documentoPadreId?: string;

  @Column({ default: false })
  confidencial: boolean;

  // Por defecto false: un documento debe habilitarse explícitamente antes
  // de ser visible en el futuro portal del cliente (Etapa 5).
  @Column({ default: false })
  clienteVisible: boolean;

  @Column({ type: 'date', nullable: true })
  fechaVencimiento?: string;

  @Column({
    type: 'enum',
    enum: EstadoCalidadDocumento,
    default: EstadoCalidadDocumento.LEGIBLE,
  })
  estadoCalidad: EstadoCalidadDocumento;

  @Column()
  subidoPorId: string;

  @CreateDateColumn()
  subidoEn: Date;

  @Column({ type: 'timestamp', nullable: true })
  eliminadoEn?: Date;

  @Column({ nullable: true })
  eliminadoPorId?: string;
}
