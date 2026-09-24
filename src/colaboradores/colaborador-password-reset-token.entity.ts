import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/** Igual que PortalPasswordResetToken, pero para cuentas de Colaborador. */
@Entity('colaborador_password_reset_tokens')
export class ColaboradorPasswordResetToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  colaboradorId: string;

  @Column({ unique: true })
  tokenHash: string;

  @Column({ type: 'timestamp' })
  expiraEn: Date;

  @Column({ type: 'timestamp', nullable: true })
  usadoEn?: Date | null;

  @CreateDateColumn()
  creadoEn: Date;
}
