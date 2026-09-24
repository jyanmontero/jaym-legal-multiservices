import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ColaboradorExpediente } from './colaborador-expediente.entity.js';
import { Expediente } from '../expedientes/expediente.entity.js';
import { AgendaEvento } from '../agenda/agenda-evento.entity.js';
import { Documento } from '../documentos/documento.entity.js';
import { DocumentosService } from '../documentos/documentos.service.js';

/**
 * Toda la lectura que el Portal de Colaboradores expone -- espejo de
 * PortalDatosService, pero para colaboradores (abogados externos/
 * corresponsales y personal de apoyo interno sin cuenta completa).
 *
 * La visibilidad depende ÚNICAMENTE de ColaboradorExpediente (ver esa
 * entidad): un colaborador solo ve los expedientes que un miembro del staff
 * le asignó explícitamente, nunca el listado completo. Nunca se expone aquí
 * notas internas, estrategia jurídica, honorarios/balance ni documentos
 * marcados confidenciales -- un colaborador externo NO es personal de la
 * firma, así que la barrera debe ser al menos tan estricta como la del
 * Portal del Cliente.
 */
@Injectable()
export class ColaboradoresPortalService {
  constructor(
    @InjectRepository(ColaboradorExpediente) private readonly asignacionRepo: Repository<ColaboradorExpediente>,
    @InjectRepository(Expediente) private readonly expedienteRepo: Repository<Expediente>,
    @InjectRepository(AgendaEvento) private readonly agendaRepo: Repository<AgendaEvento>,
    @InjectRepository(Documento) private readonly documentoRepo: Repository<Documento>,
    private readonly documentosService: DocumentosService,
  ) {}

  private vistaExpediente(e: Expediente) {
    return {
      id: e.id,
      codigo: e.codigo,
      materia: e.materia,
      tipoServicio: e.tipoServicio ?? null,
      descripcion: e.descripcion ?? null,
      objetivo: e.objetivo ?? null,
      contraparte: e.contraparte ?? null,
      estado: e.estado,
      tribunalInstitucion: e.tribunalInstitucion ?? null,
      fechaApertura: e.fechaApertura ?? null,
      fechaDeposito: e.fechaDeposito ?? null,
      proximaActuacion: e.proximaActuacion ?? null,
      fechaLimite: e.fechaLimite ?? null,
      prioridad: e.prioridad,
      // Deliberadamente NO se incluyen: notasInternas, honorariosAcordados,
      // balancePendiente, ni ningún dato del cliente -- un colaborador
      // externo no necesita esa información para hacer su parte del trabajo,
      // y son datos sensibles de la relación cliente-firma.
    };
  }

  private async idsExpedientesAsignados(colaboradorId: string): Promise<string[]> {
    const asignaciones = await this.asignacionRepo.find({ where: { colaboradorId } });
    return asignaciones.map((a) => a.expedienteId);
  }

  async listarExpedientes(colaboradorId: string) {
    const ids = await this.idsExpedientesAsignados(colaboradorId);
    if (ids.length === 0) return [];
    const expedientes = await this.expedienteRepo.find({ where: { id: In(ids) }, order: { actualizadoEn: 'DESC' } });
    return expedientes.map((e) => this.vistaExpediente(e));
  }

  private async verificarExpedienteAsignado(colaboradorId: string, expedienteId: string): Promise<void> {
    const asignacion = await this.asignacionRepo.findOne({ where: { colaboradorId, expedienteId } });
    if (!asignacion) throw new ForbiddenException('No tienes acceso a ese expediente');
  }

  async obtenerExpediente(colaboradorId: string, expedienteId: string) {
    await this.verificarExpedienteAsignado(colaboradorId, expedienteId);
    const expediente = await this.expedienteRepo.findOne({ where: { id: expedienteId } });
    if (!expediente) throw new NotFoundException('Expediente no encontrado');
    return this.vistaExpediente(expediente);
  }

  // --- Documentos ------------------------------------------------------------

  async listarDocumentos(colaboradorId: string, expedienteId: string) {
    await this.verificarExpedienteAsignado(colaboradorId, expedienteId);
    const documentos = await this.documentoRepo.find({ where: { expedienteId }, order: { subidoEn: 'DESC' } });
    // Igual criterio que PortalDatosService.listarDocumentos: doble filtro
    // deliberado -- nunca confiar solo en el filtro de la query. Un
    // colaborador nunca ve documentos confidenciales.
    return documentos
      .filter((d) => !d.confidencial && !d.eliminadoEn)
      .map((d) => ({
        id: d.id,
        nombreArchivo: d.nombreArchivo,
        categoria: d.categoria,
        descripcion: d.descripcion ?? null,
        version: d.version,
        subidoEn: d.subidoEn,
        tamanoBytes: d.tamanoBytes,
      }));
  }

  async descargarDocumento(colaboradorId: string, documentoId: string) {
    const documento = await this.documentosService.obtenerPorId(documentoId);
    const propio = Boolean(documento.expedienteId) &&
      Boolean(await this.asignacionRepo.findOne({ where: { colaboradorId, expedienteId: documento.expedienteId } }));
    if (!propio || documento.confidencial || documento.eliminadoEn) {
      throw new ForbiddenException('No tienes acceso a ese documento');
    }
    const remoto = await this.documentosService.streamDescarga(documento);
    return { documento, remoto };
  }

  // --- Agenda / tareas ---------------------------------------------------------

  /**
   * "Mis tareas" -- reutiliza la columna `colaboradores` (string[]) que ya
   * existía en AgendaEvento para colaboración entre personal interno, en
   * vez de agregar una columna nueva: un evento se asigna a un colaborador
   * externo/de apoyo agregando su id ahí, exactamente igual que se agrega
   * el id de otro abogado. No se expone `observaciones` (puede contener
   * notas internas) -- solo lo mínimo para que el colaborador sepa qué,
   * cuándo y dónde.
   */
  async listarTareas(colaboradorId: string) {
    const eventos = await this.agendaRepo
      .createQueryBuilder('e')
      .where(':id = ANY(e.colaboradores)', { id: colaboradorId })
      .orderBy('e.fechaHoraInicio', 'ASC')
      .getMany();

    return eventos.map((e) => ({
      id: e.id,
      tipo: e.tipo,
      titulo: e.titulo,
      expedienteId: e.expedienteId ?? null,
      fechaHoraInicio: e.fechaHoraInicio,
      fechaHoraFin: e.fechaHoraFin ?? null,
      prioridad: e.prioridad,
      estado: e.estado,
    }));
  }
}
