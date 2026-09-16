import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuario } from '../usuarios/usuario.entity.js';
import { ReportesService } from './reportes.service.js';
import { CorreoService } from '../notificaciones/correo.service.js';
import { EstadoUsuario, RolUsuario } from '../common/enums/index.js';

/**
 * Reportes programados -- sección 20, Etapa 4 (automatización) del
 * requerimiento. Cada lunes a las 7:00am envía a los administradores un
 * resumen ejecutivo por correo con lo que necesitan revisar esa semana,
 * reutilizando el mismo ReportesService del módulo de Reportes (sin
 * adjuntar los Excel/PDF completos -- para eso están las descargas desde
 * la página de Reportes).
 */
@Injectable()
export class ReportesScheduler {
  private readonly logger = new Logger(ReportesScheduler.name);

  constructor(
    @InjectRepository(Usuario) private readonly usuarioRepo: Repository<Usuario>,
    private readonly reportesService: ReportesService,
    private readonly correoService: CorreoService,
  ) {}

  @Cron('0 7 * * 1') // Todos los lunes a las 7:00am
  async enviarResumenSemanal(): Promise<void> {
    if (!this.correoService.estaConfigurado()) return;

    try {
      const destinatarios = await this.usuarioRepo.find({
        where: [
          { rol: RolUsuario.SUPERADMINISTRADOR, estado: EstadoUsuario.ACTIVO },
          { rol: RolUsuario.ABOGADO_ADMINISTRADOR, estado: EstadoUsuario.ACTIVO },
        ],
      });
      if (destinatarios.length === 0) return;

      const [incompletos, sinSeguimiento, cuentasPorCobrar, hoy] = await Promise.all([
        this.reportesService.expedientesIncompletos(),
        this.reportesService.expedientesSinSeguimiento(),
        this.reportesService.cuentasPorCobrar(),
        this.proximos7Dias(),
      ]);

      const html = `
        <h2 style="color:#0a1e3f;">Resumen semanal — JAYM LEGAL</h2>
        <p>${new Date().toLocaleDateString('es-DO', { dateStyle: 'full' })}</p>
        <ul>
          <li><strong>${incompletos.filas.length}</strong> expediente(s) activos con requisitos pendientes</li>
          <li><strong>${sinSeguimiento.filas.length}</strong> expediente(s) sin seguimiento reciente</li>
          <li><strong>${cuentasPorCobrar.filas.length}</strong> factura(s) con balance pendiente — ${cuentasPorCobrar.resumen?.find((r) => r.etiqueta === 'Total por cobrar')?.valor ?? ''}</li>
          <li><strong>${hoy.filas.length}</strong> audiencia(s)/vencimiento(s) en los próximos 7 días</li>
        </ul>
        <p style="font-size:12px;color:#888;">Entra al sistema y ve a "Reportes" para ver el detalle completo o descargar en Excel/PDF.</p>
      `;

      for (const admin of destinatarios) {
        await this.correoService.enviar({
          to: admin.correo,
          subject: `Resumen semanal JAYM LEGAL — ${new Date().toLocaleDateString('es-DO')}`,
          html,
        });
      }
    } catch (err) {
      this.logger.error(`No se pudo enviar el resumen semanal: ${(err as Error).message}`);
    }
  }

  private async proximos7Dias() {
    const hoy = new Date().toISOString().slice(0, 10);
    const enUnaSemana = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    return this.reportesService.audienciasYVencimientos(hoy, enUnaSemana);
  }
}
