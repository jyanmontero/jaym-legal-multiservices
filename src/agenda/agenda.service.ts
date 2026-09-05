import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository, SelectQueryBuilder } from 'typeorm';
import { AgendaEvento } from './agenda-evento.entity.js';
import { CrearEventoAgendaDto, ActualizarEventoAgendaDto } from './dto/agenda.dto.js';
import { GoogleCalendarService } from '../integraciones/google-calendar/google-calendar.service.js';
import { EstadoEventoAgenda, ROLES_CON_VISIBILIDAD_TOTAL_EXPEDIENTES } from '../common/enums/index.js';
import { ExpedientesService, type UsuarioActual } from '../expedientes/expedientes.service.js';

@Injectable()
export class AgendaService {
  constructor(
    @InjectRepository(AgendaEvento)
    private readonly eventoRepo: Repository<AgendaEvento>,
    private readonly googleCalendarService: GoogleCalendarService,
    private readonly expedientesService: ExpedientesService,
  ) {}

  /**
   * Un evento es visible si el usuario tiene visibilidad total, es el
   * responsable o colaborador del evento, o -- cuando el evento está
   * vinculado a un expediente -- si tiene visibilidad de ese expediente
   * (misma regla de responsable asignado que en ExpedientesService).
   * Réplica del patrón de verificarVisibilidad() de Documentos/Expedientes.
   */
  private async verificarVisibilidadEvento(
    evento: AgendaEvento,
    usuarioActual?: UsuarioActual,
  ): Promise<void> {
    if (!usuarioActual) return; // llamadas internas del sistema (scheduler) no se restringen
    if (ROLES_CON_VISIBILIDAD_TOTAL_EXPEDIENTES.includes(usuarioActual.rol)) return;
    if (
      evento.responsableId === usuarioActual.id ||
      evento.colaboradores.includes(usuarioActual.id)
    ) {
      return;
    }
    if (evento.expedienteId) {
      await this.expedientesService.verificarVisibilidadPorId(evento.expedienteId, usuarioActual);
      return;
    }
    throw new ForbiddenException('Este evento de agenda no te pertenece ni está asignado a ti.');
  }

  /** Versión para listados -- misma regla que verificarVisibilidadEvento(), aplicada en SQL. */
  private aplicarVisibilidadListado(
    qb: SelectQueryBuilder<AgendaEvento>,
    usuarioActual?: UsuarioActual,
  ): void {
    if (!usuarioActual || ROLES_CON_VISIBILIDAD_TOTAL_EXPEDIENTES.includes(usuarioActual.rol)) return;
    qb.leftJoin('expedientes', 'exp', 'exp.id = e."expedienteId"');
    qb.andWhere(
      '(e."expedienteId" IS NULL OR exp."abogadoResponsableId" = :miId OR exp."abogadoResponsableId" IS NULL OR e."responsableId" = :miId OR :miId = ANY(e.colaboradores))',
      { miId: usuarioActual.id },
    );
  }

  async crear(dto: CrearEventoAgendaDto, usuarioId: string): Promise<AgendaEvento> {
    const evento = this.eventoRepo.create({
      ...dto,
      fechaHoraInicio: new Date(dto.fechaHoraInicio),
      fechaHoraFin: dto.fechaHoraFin ? new Date(dto.fechaHoraFin) : undefined,
      responsableId: dto.responsableId ?? usuarioId,
      colaboradores: dto.colaboradores ?? [],
      creadoPorId: usuarioId,
    });
    const guardado = await this.eventoRepo.save(evento);

    // Mejor esfuerzo: si Google Calendar está conectado, refleja el evento
    // allá también. Si falla (o no está configurado), el evento en JAYM
    // LEGAL queda guardado igual — nunca se bloquea por esto.
    const googleEventId = await this.googleCalendarService.crearEvento({
      titulo: guardado.titulo,
      descripcion: guardado.observaciones,
      inicio: guardado.fechaHoraInicio,
      fin: guardado.fechaHoraFin,
    });
    if (googleEventId) {
      guardado.googleEventId = googleEventId;
      await this.eventoRepo.save(guardado);
    }
    return guardado;
  }

  async obtenerPorId(id: string, usuarioActual?: UsuarioActual): Promise<AgendaEvento> {
    const evento = await this.eventoRepo.findOne({ where: { id } });
    if (!evento) throw new NotFoundException('Evento de agenda no encontrado');
    await this.verificarVisibilidadEvento(evento, usuarioActual);
    return evento;
  }

  /**
   * Listado con filtros para las vistas de calendario diario/semanal/mensual
   * (sección 9) — `desde`/`hasta` acotan por fechaHoraInicio.
   */
  async listar(
    filtros: {
      expedienteId?: string;
      responsableId?: string;
      desde?: string;
      hasta?: string;
      estado?: string;
    },
    usuarioActual?: UsuarioActual,
  ): Promise<AgendaEvento[]> {
    const qb = this.eventoRepo.createQueryBuilder('e');

    if (filtros.expedienteId) qb.andWhere('e.expedienteId = :ex', { ex: filtros.expedienteId });
    if (filtros.responsableId) qb.andWhere('e.responsableId = :r', { r: filtros.responsableId });
    if (filtros.estado) qb.andWhere('e.estado = :es', { es: filtros.estado });
    if (filtros.desde) qb.andWhere('e.fechaHoraInicio >= :desde', { desde: filtros.desde });
    if (filtros.hasta) qb.andWhere('e.fechaHoraInicio <= :hasta', { hasta: filtros.hasta });

    this.aplicarVisibilidadListado(qb, usuarioActual);

    return qb.orderBy('e.fechaHoraInicio', 'ASC').getMany();
  }

  async actualizar(
    id: string,
    dto: ActualizarEventoAgendaDto,
    usuarioActual?: UsuarioActual,
  ): Promise<AgendaEvento> {
    const evento = await this.obtenerPorId(id, usuarioActual);

    const { fechaHoraInicio, fechaHoraFin, ...resto } = dto;
    Object.assign(evento, resto);
    if (fechaHoraInicio) evento.fechaHoraInicio = new Date(fechaHoraInicio);
    if (fechaHoraFin) evento.fechaHoraFin = new Date(fechaHoraFin);
    // Si se reprograma la fecha o se cambia el aviso, el recordatorio debe
    // recalcularse -- si ya se había enviado para la fecha vieja, no debe
    // quedar marcado como enviado para la nueva.
    if (fechaHoraInicio || dto.recordatorioMinutosAntes !== undefined) {
      evento.recordatorioEnviado = false;
    }

    const guardado = await this.eventoRepo.save(evento);

    if (guardado.googleEventId) {
      if (guardado.estado === EstadoEventoAgenda.CANCELADO) {
        await this.googleCalendarService.cancelarEvento(guardado.googleEventId);
      } else {
        await this.googleCalendarService.actualizarEvento(guardado.googleEventId, {
          titulo: guardado.titulo,
          descripcion: guardado.observaciones,
          inicio: guardado.fechaHoraInicio,
          fin: guardado.fechaHoraFin,
        });
      }
    }

    return guardado;
  }

  /** Usado por AlertasService para detectar eventos próximos/vencidos. */
  async listarEntreFechas(desde: Date, hasta: Date): Promise<AgendaEvento[]> {
    return this.eventoRepo.find({ where: { fechaHoraInicio: Between(desde, hasta) } });
  }

  async listarVencidosNoCompletados(antesDe: Date): Promise<AgendaEvento[]> {
    return this.eventoRepo
      .createQueryBuilder('e')
      .where('e.fechaHoraInicio < :antesDe', { antesDe })
      .andWhere('e.estado NOT IN (:...estados)', {
        estados: ['completado', 'cancelado'],
      })
      .getMany();
  }
}
