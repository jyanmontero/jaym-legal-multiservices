import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * Token de un solo uso para el flujo de "olvidé mi contraseña". Se guarda
 * el hash (sha256) del token, nunca el valor real -- igual que con las
 * contraseñas, así que aunque alguien lea la base de datos no puede usar
 * los enlaces directamente. El token real solo existe en el correo que
 * recibe el usuario.
 *
 * No hace falta una relación formal con Usuario (ver el mismo patrón en
 * Alerta, Documento, etc.) -- basta con el id como referencia simple.
 */
@Entity('password_reset_tokens')
export class PasswordResetToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  usuarioId: string;

  @Index({ unique: true })
  @Column()
  tokenHash: string;

  @Column({ type: 'timestamp' })
  expiraEn: Date;

  // Se marca al usarse en vez de borrarse -- deja rastro de que el enlace
  // ya fue consumido si alguien intenta reutilizarlo.
  @Column({ type: 'timestamp', nullable: true })
  usadoEn?: Date | null;

  @CreateDateColumn()
  creadoEn: Date;
}
