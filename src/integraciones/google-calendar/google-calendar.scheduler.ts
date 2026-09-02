import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GoogleCalendarService } from './google-calendar.service.js';
import { AgendaEvento } from '../../agenda/agenda-evento.entity.js';
import { UsuariosService } from '../../usuarios/usuarios.service.js';
import { TipoEventoAgenda, EstadoEventoAgenda, RolUsuario } from '../../common/enums/index.js';

/**
 * Trae hacia la Agenda de JAYM LEGAL los eventos que alguien creó
 * directamente en Google Calendar (en vez de crearlos aquí) — es la parte
 * "de Google hacia el sistema" de la sincronización. Como este backend
 * corre en localhost (sin dirección pública), Google no puede avisarnos al
 * instante cuando algo cambia allá, así que en vez de eso revisamos cada
 * 10 minutos. Un evento creado DESDE JAYM LEGAL nunca se vuelve a importar
 * aquí porque ya tiene su `googleEventId` guardado desde que se creó.
 */
@Injectable()
export class GoogleCalendarScheduler {
  private readonly logger = new Logger(GoogleCalendarScheduler.name);

  constructor(
    private readonly googleCalendarService: GoogleCalendarService,
    private readonly usuariosService: UsuariosService,
    @InjectRepository(AgendaEvento)
    private readonly eventoRepo: Repository<AgendaEvento>,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async importarDesdeGoogle() {
    if (!this.googleCalendarService.estaConfigurado()) return;

    const desde = new Date();
    const hasta = new Date(desde.getTime() + 90 * 24 * 60 * 60 * 1000); // próximos 90 días
    const eventosGoogle = await this.googleCalendarService.listarEventos(desde, hasta);
    if (eventosGoogle.length === 0) return;

    const yaImportados = await this.eventoRepo.find({
      where: eventosGoogle.map((e) => ({ googleEventId: e.id })),
      select: { googleEventId: true },
    });
    const idsYaImportados = new Set(yaImportados.map((e) => e.googleEventId));

    const nuevos = eventosGoogle.filter((e) => e.inicio && !idsYaImportados.has(e.id));
    if (nuevos.length === 0) return;

    const usuarios = await this.usuariosService.listar();
    const responsablePorDefecto = usuarios.find((u) => u.rol === RolUsuario.SUPERADMINISTRADOR);
    if (!responsablePorDefecto) {
      this.logger.warn(
        'Hay eventos nuevos en Google Calendar pero no se pudieron importar: no existe ningún usuario Superadministrador para asignarlos como responsable.',
      );
      return;
    }

    for (const evento of nuevos) {
      await this.eventoRepo.save(
        this.eventoRepo.create({
          tipo: TipoEventoAgenda.CITA,
          titulo: evento.titulo,
          fechaHoraInicio: new Date(evento.inicio!),
          fechaHoraFin: evento.fin ? new Date(evento.fin) : undefined,
          responsableId: responsablePorDefecto.id,
          estado: EstadoEventoAgenda.PENDIENTE,
          observaciones: evento.descripcion
            ? `${evento.descripcion}\n\n(Importado automáticamente desde Google Calendar)`
            : 'Importado automáticamente desde Google Calendar.',
          creadoPorId: responsablePorDefecto.id,
          googleEventId: evento.id,
        }),
      );
    }
    this.logger.log(`Se importaron ${nuevos.length} evento(s) nuevo(s) desde Google Calendar.`);
  }
}
