import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { TipoColaborador } from '../common/enums/index.js';

/**
 * Portal de Colaboradores -- sirve a dos audiencias (decisión del 24/09/2026):
 * abogados externos/corresponsales de otras firmas, y personal de apoyo
 * interno sin una cuenta completa de `Usuario` (ej. mensajería, gestión de
 * trámites). `tipo` solo distingue esas dos audiencias para la interfaz;
 * NO otorga permisos distintos por sí mismo -- el acceso real depende de
 * qué expedientes se le asignaron (ver ColaboradorExpediente).
 *
 * Deliberadamente separada de `Usuario` (staff con cuenta completa) y de
 * `PortalUsuario` (clientes): vive en su propia tabla, con su propio login y
 * su propio JWT (ver ColaboradorAuthService/ColaboradorAuthGuard), para que
 * nunca pueda confundirse con una cuenta de staff ni heredar por accidente
 * ningún permiso interno o rol (RolUsuario).
 */
@Entity('colaboradores')
export class Colaborador {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nombreCompleto: string;

  @Index({ unique: true })
  @Column()
  correo: string;

  // Nunca se expone en respuestas -- ver exclusión manual en el servicio,
  // mismo criterio que Usuario.passwordHash y PortalUsuario.passwordHash.
  @Column()
  passwordHash: string;

  @Column({ type: 'enum', enum: TipoColaborador })
  tipo: TipoColaborador;

  @Column({ nullable: true })
  telefono?: string;

  @Column('text', { nullable: true })
  notas?: string;

  @Column({ default: true })
  activo: boolean;

  // true justo después de crearse (contraseña temporal generada por el
  // sistema) o tras un reseteo administrativo -- mismo patrón que
  // PortalUsuario.debeCambiarPassword.
  @Column({ default: true })
  debeCambiarPassword: boolean;

  // Se incrementa cada vez que cambia la contraseña (propia o por reseteo
  // administrativo) o cuando se desactiva/reactiva la cuenta. ColaboradorAuthGuard
  // compara este valor contra el que quedó grabado en el JWT al emitirlo: si
  // no coincide, el token es de una sesión anterior y se rechaza. Sin esto,
  // un JWT ya emitido (vigente hasta 14 días) seguía siendo válido aunque se
  // desactivara al colaborador o se le reseteara la contraseña -- ver
  // resolución del 26/09/2026.
  @Column({ type: 'int', default: 0 })
  tokenVersion: number;

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
