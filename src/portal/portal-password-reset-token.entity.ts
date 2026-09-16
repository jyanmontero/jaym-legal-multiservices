import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/** Igual que PasswordResetToken (auth/), pero para cuentas del Portal del Cliente. */
@Entity('portal_password_reset_tokens')
export class PortalPasswordResetToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  portalUsuarioId: string;

  @Column({ unique: true })
  tokenHash: string;

  @Column({ type: 'timestamp' })
  expiraEn: Date;

  @Column({ type: 'timestamp', nullable: true })
  usadoEn?: Date | null;

  @CreateDateColumn()
  creadoEn: Date;
}
