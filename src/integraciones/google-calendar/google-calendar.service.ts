import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, calendar_v3 } from 'googleapis';

export interface EventoGoogleCalendar {
  id: string;
  titulo: string;
  descripcion?: string;
  inicio?: string; // ISO
  fin?: string; // ISO
}

/**
 * Integración con Google Calendar — sigue el mismo patrón que HubSpot
 * (ver ../hubspot): no hay flujo OAuth propio dentro de este backend (nada
 * de pantallas de "Conectar con Google" ni callback), porque para un
 * sistema que corre en localhost eso complica muchísimo las cosas sin
 * necesidad. En vez de eso, el superadministrador obtiene UNA vez un
 * "refresh token" de larga duración (con Google OAuth Playground, usando
 * sus propias credenciales de Google Cloud) y lo pega en el .env — ver
 * .env.example para la guía completa. A partir de ahí, este servicio
 * renueva el acceso automáticamente en cada llamada; nunca hay que volver
 * a autenticar a mano salvo que el usuario revoque el acceso desde Google.
 */
@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);

  constructor(private readonly config: ConfigService) {}

  estaConfigurado(): boolean {
    return Boolean(
      this.config.get<string>('GOOGLE_CLIENT_ID') &&
        this.config.get<string>('GOOGLE_CLIENT_SECRET') &&
        this.config.get<string>('GOOGLE_REFRESH_TOKEN'),
    );
  }

  private calendarId(): string {
    return this.config.get<string>('GOOGLE_CALENDAR_ID') || 'primary';
  }

  private cliente(): calendar_v3.Calendar {
    const oAuth2Client = new google.auth.OAuth2(
      this.config.get<string>('GOOGLE_CLIENT_ID'),
      this.config.get<string>('GOOGLE_CLIENT_SECRET'),
    );
    oAuth2Client.setCredentials({ refresh_token: this.config.get<string>('GOOGLE_REFRESH_TOKEN') });
    return google.calendar({ version: 'v3', auth: oAuth2Client });
  }

  private mapear(evento: calendar_v3.Schema$Event): EventoGoogleCalendar {
    return {
      id: evento.id!,
      titulo: evento.summary || '(sin título)',
      descripcion: evento.description ?? undefined,
      inicio: evento.start?.dateTime || evento.start?.date || undefined,
      fin: evento.end?.dateTime || evento.end?.date || undefined,
    };
  }

  /**
   * Lista eventos entre dos fechas — usada por el asistente para responder
   * "¿qué tengo esta semana?" y por el importador periódico (ver
   * google-calendar.scheduler.ts) para traer eventos creados directamente
   * en Google hacia la Agenda de JAYM LEGAL.
   */
  async listarEventos(desde: Date, hasta: Date): Promise<EventoGoogleCalendar[]> {
    if (!this.estaConfigurado()) return [];
    try {
      const { data } = await this.cliente().events.list({
        calendarId: this.calendarId(),
        timeMin: desde.toISOString(),
        timeMax: hasta.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 250,
      });
      return (data.items ?? [])
        .filter((e) => e.status !== 'cancelled')
        .map((e) => this.mapear(e));
    } catch (err) {
      this.logger.warn(`No se pudo listar eventos de Google Calendar: ${(err as Error).message}`);
      return [];
    }
  }

  /**
   * Crea el evento en Google Calendar. Devuelve el id del evento creado,
   * o null si la integración no está configurada o la llamada falla — se
   * trata como "mejor esfuerzo": el evento en JAYM LEGAL se guarda igual,
   * simplemente no queda reflejado en Google hasta que se resuelva.
   */
  async crearEvento(datos: {
    titulo: string;
    descripcion?: string;
    inicio: Date;
    fin?: Date;
  }): Promise<string | null> {
    if (!this.estaConfigurado()) return null;
    try {
      const fin = datos.fin ?? new Date(datos.inicio.getTime() + 60 * 60 * 1000);
      const { data } = await this.cliente().events.insert({
        calendarId: this.calendarId(),
        requestBody: {
          summary: datos.titulo,
          description: datos.descripcion,
          start: { dateTime: datos.inicio.toISOString(), timeZone: 'America/Santo_Domingo' },
          end: { dateTime: fin.toISOString(), timeZone: 'America/Santo_Domingo' },
        },
      });
      return data.id ?? null;
    } catch (err) {
      this.logger.warn(`No se pudo crear el evento en Google Calendar: ${(err as Error).message}`);
      return null;
    }
  }

  async actualizarEvento(
    googleEventId: string,
    datos: { titulo?: string; descripcion?: string; inicio?: Date; fin?: Date },
  ): Promise<void> {
    if (!this.estaConfigurado()) return;
    try {
      await this.cliente().events.patch({
        calendarId: this.calendarId(),
        eventId: googleEventId,
        requestBody: {
          ...(datos.titulo ? { summary: datos.titulo } : {}),
          ...(datos.descripcion !== undefined ? { description: datos.descripcion } : {}),
          ...(datos.inicio
            ? { start: { dateTime: datos.inicio.toISOString(), timeZone: 'America/Santo_Domingo' } }
            : {}),
          ...(datos.fin
            ? { end: { dateTime: datos.fin.toISOString(), timeZone: 'America/Santo_Domingo' } }
            : {}),
        },
      });
    } catch (err) {
      this.logger.warn(`No se pudo actualizar el evento en Google Calendar: ${(err as Error).message}`);
    }
  }

  async cancelarEvento(googleEventId: string): Promise<void> {
    if (!this.estaConfigurado()) return;
    try {
      await this.cliente().events.delete({ calendarId: this.calendarId(), eventId: googleEventId });
    } catch (err: any) {
      // 410/404: ya estaba borrado en Google (por ejemplo, a mano) — no es un error real.
      if (err?.code !== 410 && err?.code !== 404) {
        this.logger.warn(`No se pudo cancelar el evento en Google Calendar: ${err?.message}`);
      }
    }
  }
}
