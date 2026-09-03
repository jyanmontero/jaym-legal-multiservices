import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { AlertasService } from './alertas.service.js';
import { CorreoService } from '../notificaciones/correo.service.js';
import { Alerta } from './alerta.entity.js';
import { SeveridadAlerta } from '../common/enums/index.js';

const SEVERIDAD_LABEL: Record<SeveridadAlerta, string> = {
  [SeveridadAlerta.CRITICA]: 'Crítica',
  [SeveridadAlerta.URGENTE]: 'Urgente',
  [SeveridadAlerta.ATENCION]: 'Atención',
  [SeveridadAlerta.INFORMATIVA]: 'Informativa',
};

@Injectable()
export class AlertasScheduler {
  private readonly logger = new Logger(AlertasScheduler.name);

  constructor(
    private readonly alertasService: AlertasService,
    private readonly correoService: CorreoService,
    private readonly config: ConfigService,
  ) {}

  private destinatarios(): string[] {
    const crudo = this.config.get<string>('ALERTAS_CORREO_DESTINATARIOS') || '';
    return crudo
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean);
  }

  private renderLista(alertas: Alerta[]): string {
    return `<ul>${alertas
      .map(
        (a) =>
          `<li><strong>${SEVERIDAD_LABEL[a.severidad]}</strong> — ${a.mensaje}</li>`,
      )
      .join('')}</ul>`;
  }

  // Corre cada hora — suficiente para un despacho de este tamaño (1 a 5
  // usuarios); se puede ajustar sin tocar el motor de reglas en sí.
  @Cron(CronExpression.EVERY_HOUR)
  async ejecutar() {
    this.logger.log('Ejecutando motor de alertas programado...');
    const resultado = await this.alertasService.generarAlertas();

    const destinatarios = this.destinatarios();
    if (!destinatarios.length || !this.correoService.estaConfigurado()) return;

    // Solo se envía un correo inmediato para lo que de verdad no puede
    // esperar al resumen diario -- crítica y urgente.
    const graves = resultado.nuevas.filter(
      (a) => a.severidad === SeveridadAlerta.CRITICA || a.severidad === SeveridadAlerta.URGENTE,
    );
    if (!graves.length) return;

    await this.correoService.enviar({
      to: destinatarios.join(','),
      subject: `JAYM LEGAL — ${graves.length} alerta(s) urgente(s) nueva(s)`,
      html: `<p>El sistema detectó lo siguiente:</p>${this.renderLista(graves)}<p>Revísalo en el panel de alertas.</p>`,
    });
  }

  // Resumen diario de todo lo que sigue abierto -- para no depender de que
  // alguien revise el panel; llega a las 7:00am hora del servidor.
  @Cron('0 7 * * *')
  async resumenDiario() {
    const destinatarios = this.destinatarios();
    if (!destinatarios.length || !this.correoService.estaConfigurado()) return;

    const abiertas = await this.alertasService.listar({ resuelta: false });
    if (!abiertas.length) return;

    const porSeveridad = [SeveridadAlerta.CRITICA, SeveridadAlerta.URGENTE, SeveridadAlerta.ATENCION, SeveridadAlerta.INFORMATIVA]
      .map((s) => ({ severidad: s, alertas: abiertas.filter((a) => a.severidad === s) }))
      .filter((g) => g.alertas.length > 0);

    const html = porSeveridad
      .map((g) => `<h3>${SEVERIDAD_LABEL[g.severidad]} (${g.alertas.length})</h3>${this.renderLista(g.alertas)}`)
      .join('');

    await this.correoService.enviar({
      to: destinatarios.join(','),
      subject: `JAYM LEGAL — Resumen diario: ${abiertas.length} alerta(s) abierta(s)`,
      html: `<p>Estado del panel de alertas esta mañana:</p>${html}`,
    });
  }
}
