import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { RolUsuario } from '../common/enums/index.js';

/**
 * Permiso fino por rol sobre un documento específico — complementa (no
 * reemplaza) el flag `confidencial` de Documento. Solo es necesario crear
 * filas aquí para roles que NO están en
 * ROLES_CON_ACCESO_CONFIDENCIAL_POR_DEFECTO pero que sí deben poder ver un
 * documento confidencial puntual.
 */
@Entity('documento_permisos')
export class DocumentoPermiso {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  documentoId: string;

  @Column({ type: 'enum', enum: RolUsuario })
  rol: RolUsuario;

  @Column({ default: true })
  puedeVer: boolean;

  @Column({ default: false })
  puedeDescargar: boolean;
}
