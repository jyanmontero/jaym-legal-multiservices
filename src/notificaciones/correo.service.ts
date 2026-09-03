import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/**
 * Envío de correo saliente vía SMTP — sigue el mismo patrón que las demás
 * integraciones (GoogleCalendarService, HubspotService): sin credenciales
 * en el .env, estaConfigurado() da false y enviar() no hace nada (solo
 * deja un log), en vez de romper el arranque del sistema. Ver
 * .env.example para la guía de cómo generar una contraseña de aplicación
 * de Gmail y configurar las variables SMTP_*.
 */
@Injectable()
export class CorreoService {
  private readonly logger = new Logger(CorreoService.name);
  private transporte: nodemailer.Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  estaConfigurado(): boolean {
    return Boolean(this.config.get<string>('SMTP_USER') && this.config.get<string>('SMTP_PASS'));
  }

  private obtenerTransporte(): nodemailer.Transporter {
    if (!this.transporte) {
      this.transporte = nodemailer.createTransport({
        host: this.config.get<string>('SMTP_HOST') || 'smtp.gmail.com',
        port: Number(this.config.get<string>('SMTP_PORT')) || 465,
        secure: (this.config.get<string>('SMTP_SECURE') ?? 'true') === 'true',
        auth: {
          user: this.config.get<string>('SMTP_USER'),
          pass: this.config.get<string>('SMTP_PASS'),
        },
      });
    }
    return this.transporte;
  }

  private remitente(): string {
    return this.config.get<string>('SMTP_FROM') || this.config.get<string>('SMTP_USER') || '';
  }

  /**
   * Envía un correo. Si SMTP no está configurado, no lanza error -- solo
   * registra una advertencia y sigue (mismo criterio que el resto de
   * integraciones opcionales de este sistema). `to` acepta un correo o
   * varios separados por coma.
   */
  async enviar(opciones: { to: string; subject: string; html: string }): Promise<boolean> {
    if (!this.estaConfigurado()) {
      this.logger.warn(
        `SMTP no configurado -- no se envió el correo "${opciones.subject}". Ver .env.example (SMTP_*).`,
      );
      return false;
    }
    try {
      await this.obtenerTransporte().sendMail({
        from: this.remitente(),
        to: opciones.to,
        subject: opciones.subject,
        html: opciones.html,
      });
      return true;
    } catch (err) {
      this.logger.error(`Error enviando correo "${opciones.subject}": ${(err as Error).message}`);
      return false;
    }
  }
}
