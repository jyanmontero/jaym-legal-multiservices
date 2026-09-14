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

  // Endurecimiento de seguridad (auditoría 14-sep-2026): bloqueo temporal
  // de la cuenta tras varios intentos de login fallidos seguidos, además
  // del límite por IP que ya existía en el endpoint (ver
  // auth.controller.ts). Se resetean ambos en cuanto hay un login exitoso.
  @Column({ type: 'int', default: 0 })
  intentosFallidosLogin: number;

  @Column({ type: 'timestamp', nullable: true })
  bloqueadoHastaLogin?: Date;

  // Excepciones puntuales a MATRIZ_PERMISOS_POR_ROL para este usuario en
  // concreto (sección 15: "Definir permisos independientes"). Solo se
  // guardan las diferencias respecto al rol -- ej. { "facturar": true }
  // le da permiso de facturar a un asistente sin tener que crearle un rol
  // nuevo solo por eso. Si un permiso no aparece aquí, manda el valor por
  // defecto del rol (ver auth/permisos/tiene-permiso.ts).
  @Column({ type: 'jsonb', nullable: true })
  permisosPersonalizados?: Partial<Record<string, boolean>>;

  @CreateDateColumn()
  creadoEn: Date;

  @UpdateDateColumn()
  actualizadoEn: Date;
}
