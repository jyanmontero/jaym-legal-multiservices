import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgendaEvento } from './agenda-evento.entity.js';
import { CorreoService } from '../notificaciones/correo.service.js';
import { UsuariosService } from '../usuarios/usuarios.service.js';
import { EstadoEventoAgenda, TipoEventoAgenda } from '../common/enums/index.js';

const TIPO_LABEL: Record<TipoEventoAgenda, string> = {
  [TipoEventoAgenda.AUDIENCIA]: 'Audiencia',
  [TipoEventoAgenda.CITA]: 'Cita',
  [TipoEventoAgenda.REUNION]: 'Reunión',
  [TipoEventoAgenda.DEPOSITO]: 'Depósito',
  [TipoEventoAgenda.SEGUIMIENTO]: 'Seguimiento',
  [TipoEventoAgenda.VENCIMIENTO]: 'Vencimiento',
  [TipoEventoAgenda.LLAMADA]: 'Llamada',
  [TipoEventoAgenda.TAREA_INTERNA]: 'Tarea interna',
  [TipoEventoAgenda.PLAZO_JUDICIAL]: 'Plazo judicial',
};

/**
 * Dispara el recordatorio por correo de un evento de agenda -- el campo
 * `recordatorioMinutosAntes` (sección 9) existía desde antes pero nada lo
 * leía todavía. Reutiliza el mismo CorreoService que las alertas.
 */
@Injectable()
export class AgendaScheduler {
  private readonly logger = new Logger(AgendaScheduler.name);

  constructor(
    @InjectRepository(AgendaEvento)
    private readonly eventoRepo: Repository<AgendaEvento>,
    private readonly correoService: CorreoService,
    private readonly usuariosService: UsuariosService,
  ) {}

  // Cada 5 minutos es suficiente resolución para un aviso de "X minutos
  // antes" sin sobrecargar la base de datos.
  @Cron(CronExpression.EVERY_5_MINUTES)
  async enviarRecordatorios() {
    if (!this.correoService.estaConfigurado()) return;

    const ahora = new Date();
    // No se dispara un recordatorio para un evento cuyo momento de aviso
    // quedó hace más de un día -- evita un envío masivo retroactivo si el
    // cron estuvo caído o si esto se despliega con eventos viejos que ya
    // tenían el campo configurado.
    const haceUnDia = new Date(ahora.getTime() - 24 * 60 * 60 * 1000);

    const eventos = await this.eventoRepo
      .createQueryBuilder('e')
      .where('e.recordatorioMinutosAntes IS NOT NULL')
      .andWhere('e.recordatorioEnviado = false')
      .andWhere('e.estado NOT IN (:...estadosExcluidos)', {
        estadosExcluidos: [EstadoEventoAgenda.COMPLETADO, EstadoEventoAgenda.CANCELADO],
      })
      .andWhere(
        `e."fechaHoraInicio" - (e."recordatorioMinutosAntes" * INTERVAL '1 minute') <= :ahora`,
        { ahora },
      )
      .andWhere('e."fechaHoraInicio" >= :haceUnDia', { haceUnDia })
      .getMany();

    for (const evento of eventos) {
      await this.enviarRecordatorio(evento);
    }
  }

  private async enviarRecordatorio(evento: AgendaEvento): Promise<void> {
    try {
      const responsable = await this.usuariosService.buscarPorId(evento.responsableId);
      if (responsable?.correo) {
        const fecha = new Date(evento.fechaHoraInicio).toLocaleString('es-DO', {
          dateStyle: 'full',
          timeStyle: 'short',
        });
        await this.correoService.enviar({
          to: responsable.correo,
          subject: `Recordatorio — ${TIPO_LABEL[evento.tipo]}: ${evento.titulo}`,
          html: `<p>Tienes ${TIPO_LABEL[evento.tipo].toLowerCase()} programada:</p>
<p><strong>${evento.titulo}</strong><br>${fecha}</p>
${evento.observaciones ? `<p>${evento.observaciones}</p>` : ''}`,
        });
      }
    } catch (err) {
      this.logger.warn(
        `No se pudo enviar el recordatorio del evento ${evento.id}: ${(err as Error).message}`,
      );
    } finally {
      // Se marca como enviado aun si el correo falló (usuario ya no existe,
      // SMTP caído puntualmente) -- mismo criterio de "mejor esfuerzo, nunca
      // bloqueante" que el resto del sistema (HubSpot, Google Calendar):
      // reintentar cada 5 minutos indefinidamente sería peor que perder un
      // aviso puntual.
      await this.eventoRepo.update(evento.id, { recordatorioEnviado: true });
    }
  }
}
