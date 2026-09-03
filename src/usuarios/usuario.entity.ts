import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { RolUsuario, EstadoUsuario } from '../common/enums/index.js';

/**
 * Usuario interno de JAYM LEGAL (staff) — sección 15 del requerimiento.
 * No confundir con `portal_usuarios` (Etapa 5), que es la cuenta de acceso
 * de los clientes al portal, con su propio conjunto de permisos, mucho
 * más restringido.
 */
@Entity('usuarios')
export class Usuario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nombreCompleto: string;

  @Index({ unique: true })
  @Column()
  correo: string;

  // Nunca se expone en respuestas — ver ClassSerializerInterceptor /
  // exclusión manual en el servicio.
  @Column()
  passwordHash: string;

  @Column({ type: 'enum', enum: RolUsuario })
  rol: RolUsuario;

  @Column({ type: 'enum', enum: EstadoUsuario, default: EstadoUsuario.ACTIVO })
  estado: EstadoUsuario;

  @Column({ default: false })
  dosFactorActivo: boolean;

  // Secreto TOTP -- cifrado a nivel de aplicación antes de guardarse (ver
  // common/cifrado/cifrado.service.ts y usuarios.service.ts). El campo
  // sigue siendo texto libre porque el valor cifrado también es texto.
  @Column({ nullable: true })
  dosFactorSecreto?: string;

  @Column({ type: 'timestamp', nullable: true })
  ultimoAcceso?: Date;

  @CreateDateColumn()
  creadoEn: Date;

  @UpdateDateColumn()
  actualizadoEn: Date;
}
