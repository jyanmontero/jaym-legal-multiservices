import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Cuenta de acceso de un cliente al Portal del Cliente -- Etapa 5 del
 * requerimiento (sección 16). Deliberadamente separada de `Usuario`
 * (personal interno de la firma): vive en su propia tabla, con su propio
 * flujo de login y su propio JWT (ver PortalAuthService/PortalAuthGuard),
 * para que nunca pueda confundirse con una cuenta de staff ni heredar por
 * accidente ningún permiso interno.
 *
 * Un mismo cliente (persona física o jurídica) puede tener más de una
 * cuenta -- ej. el representante legal y un apoderado -- por eso
 * `clienteId` no es único.
 */
@Entity('portal_usuarios')
@Index(['clienteId'])
export class PortalUsuario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  clienteId: string;

  @Column()
  nombreCompleto: string;

  @Index({ unique: true })
  @Column()
  correo: string;

  // Nunca se expone en respuestas -- ver exclusión manual en el servicio,
  // mismo criterio que Usuario.passwordHash.
  @Column()
  passwordHash: string;

  @Column({ default: true })
  activo: boolean;

  // true justo después de crearse (contraseña temporal generada por el
  // sistema) o tras un reseteo administrativo -- obliga a cambiarla en el
  // primer acceso, sin bloquear el resto del flujo.
  @Column({ default: true })
  debeCambiarPassword: boolean;

  @Column({ type: 'timestamp', nullable: true })
  ultimoAcceso?: Date;

  @Column({ type: 'int', default: 0 })
  intentosFallidosLogin: number;

  @Column({ type: 'timestamp', nullable: true })
  bloqueadoHastaLogin?: Date;

  @Column({ nullable: true })
  creadoPorId?: string;

  @CreateDateColumn()
  creadoEn: Date;

  @UpdateDateColumn()
  actualizadoEn: Date;
}
