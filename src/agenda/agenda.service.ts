import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { AgendaEvento } from './agenda-evento.entity.js';
import { CrearEventoAgendaDto, ActualizarEventoAgendaDto } from './dto/agenda.dto.js';
import { GoogleCalendarService } from '../integraciones/google-calendar/google-calendar.service.js';
import { EstadoEventoAgenda } from '../common/enums/index.js';

@Injectable()
export class AgendaService {
  constructor(
    @InjectRepository(AgendaEvento)
    private readonly eventoRepo: Repository<AgendaEvento>,
    private readonly googleCalendarService: GoogleCalendarService,
  ) {}

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

  async obtenerPorId(id: string): Promise<AgendaEvento> {
    const evento = await this.eventoRepo.findOne({ where: { id } });
    if (!evento) throw new NotFoundException('Evento de agenda no encontrado');
    return evento;
  }

  /**
   * Listado con filtros para las vistas de calendario diario/semanal/mensual
   * (sección 9) — `desde`/`hasta` acotan por fechaHoraInicio.
   */
  async listar(filtros: {
    expedienteId?: string;
    responsableId?: string;
    desde?: string;
    hasta?: string;
    estado?: string;
  }): Promise<AgendaEvento[]> {
    const qb = this.eventoRepo.createQueryBuilder('e');

    if (filtros.expedienteId) qb.andWhere('e.expedienteId = :ex', { ex: filtros.expedienteId });
    if (filtros.responsableId) qb.andWhere('e.responsableId = :r', { r: filtros.responsableId });
    if (filtros.estado) qb.andWhere('e.estado = :es', { es: filtros.estado });
    if (filtros.desde) qb.andWhere('e.fechaHoraInicio >= :desde', { desde: filtros.desde });
    if (filtros.hasta) qb.andWhere('e.fechaHoraInicio <= :hasta', { hasta: filtros.hasta });

    return qb.orderBy('e.fechaHoraInicio', 'ASC').getMany();
  }

  async actualizar(id: string, dto: ActualizarEventoAgendaDto): Promise<AgendaEvento> {
    const evento = await this.obtenerPorId(id);

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
