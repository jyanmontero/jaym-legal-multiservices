import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expediente } from '../expedientes/expediente.entity.js';
import { AgendaEvento } from '../agenda/agenda-evento.entity.js';
import { MensajePortal } from './mensaje-portal.entity.js';
import { DocumentosService } from '../documentos/documentos.service.js';
import { FacturacionService } from '../facturacion/facturacion.service.js';
import { PdfService } from '../facturacion/pdf/pdf.service.js';
import { ExpedienteRequisitosService } from '../requisitos/expediente-requisitos.service.js';
import { SubirDocumentoDto } from '../documentos/dto/subir-documento.dto.js';
import { CategoriaDocumento, EstadoEventoAgenda } from '../common/enums/index.js';
import { ClientesService } from '../clientes/clientes.service.js';

/**
 * Toda la lectura/escritura que el Portal del Cliente expone -- sección 16.
 * Cada método recibe `clienteId` (viene del JWT del portal, nunca del
 * body/query) y filtra explícitamente por él: es la única barrera real
 * entre "un cliente ve sus propios datos" y "un cliente ve los de otro".
 * Nunca se exponen aquí notas internas, estrategia jurídica, datos de la
 * contraparte ni documentos con clienteVisible=false.
 */
@Injectable()
export class PortalDatosService {
  constructor(
    @InjectRepository(Expediente) private readonly expedienteRepo: Repository<Expediente>,
    @InjectRepository(AgendaEvento) private readonly agendaRepo: Repository<AgendaEvento>,
    @InjectRepository(MensajePortal) private readonly mensajeRepo: Repository<MensajePortal>,
    private readonly documentosService: DocumentosService,
    private readonly facturacionService: FacturacionService,
    private readonly pdfService: PdfService,
    private readonly requisitosService: ExpedienteRequisitosService,
    private readonly clientesService: ClientesService,
  ) {}

  private vistaExpediente(e: Expediente, progreso?: { porcentaje: number; pendientesObligatorios: { nombreRequisito: string }[] }) {
    return {
      id: e.id,
      codigo: e.codigo,
      materia: e.materia,
      tipoServicio: e.tipoServicio ?? null,
      estado: e.estado,
      tribunalInstitucion: e.tribunalInstitucion ?? null,
      fechaApertura: e.fechaApertura ?? null,
      fechaDeposito: e.fechaDeposito ?? null,
      proximaActuacion: e.proximaActuacion ?? null,
      fechaLimite: e.fechaLimite ?? null,
      balancePendiente: e.balancePendiente,
      ...(progreso
        ? {
            porcentajeCompletado: progreso.porcentaje,
            requisitosPendientes: progreso.pendientesObligatorios.map((r) => r.nombreRequisito),
          }
        : {}),
    };
  }

  async listarExpedientes(clienteId: string) {
    const expedientes = await this.expedienteRepo.find({ where: { clienteId }, order: { actualizadoEn: 'DESC' } });
    return expedientes.map((e) => this.vistaExpediente(e));
  }

  async obtenerExpediente(clienteId: string, expedienteId: string) {
    const expediente = await this.expedienteRepo.findOne({ where: { id: expedienteId } });
    if (!expediente || expediente.clienteId !== clienteId) {
      throw new NotFoundException('Expediente no encontrado');
    }
    const progreso = await this.requisitosService.calcularProgreso(expediente.id);
    return this.vistaExpediente(expediente, progreso);
  }

  private async verificarExpedientePropio(clienteId: string, expedienteId: string): Promise<void> {
    const expediente = await this.expedienteRepo.findOne({ where: { id: expedienteId } });
    if (!expediente || expediente.clienteId !== clienteId) {
      throw new ForbiddenException('No tienes acceso a ese expediente');
    }
  }

  // --- Documentos ----------------------------------------------------------

  async listarDocumentos(clienteId: string, expedienteId?: string) {
    if (expedienteId) await this.verificarExpedientePropio(clienteId, expedienteId);

    const documentos = await this.documentosService.listar({
      clienteId: expedienteId ? undefined : clienteId,
      expedienteId,
    });
    const lista = Array.isArray(documentos) ? documentos : (documentos as any).datos;

    // Doble filtro deliberado: aunque ya se pidió por clienteId/expedienteId,
    // solo se devuelve lo marcado explícitamente como visible para el
    // cliente y no eliminado -- nunca confiar solo en el filtro de la query.
    return lista
      .filter((d: any) => d.clienteVisible && !d.eliminadoEn)
      .map((d: any) => ({
        id: d.id,
        nombreArchivo: d.nombreArchivo,
        categoria: d.categoria,
        descripcion: d.descripcion ?? null,
        version: d.version,
        subidoEn: d.subidoEn,
        tamanoBytes: d.tamanoBytes,
      }));
  }

  async subirDocumento(
    clienteId: string,
    portalUsuarioId: string,
    archivo: Express.Multer.File,
    opciones: { expedienteId?: string; categoria?: CategoriaDocumento; descripcion?: string },
  ) {
    if (opciones.expedienteId) await this.verificarExpedientePropio(clienteId, opciones.expedienteId);

    const dto: SubirDocumentoDto = {
      clienteId: opciones.expedienteId ? undefined : clienteId,
      expedienteId: opciones.expedienteId,
      categoria: opciones.categoria ?? CategoriaDocumento.OTROS,
      descripcion: opciones.descripcion,
      // Un documento que sube el propio cliente siempre queda visible para
      // él (obviamente) y nunca se marca confidencial -- ese concepto es
      // interno de la firma.
      clienteVisible: true,
      confidencial: false,
    };
    return this.documentosService.subir(dto, archivo, portalUsuarioId);
  }

  async descargarDocumento(clienteId: string, documentoId: string) {
    const documento = await this.documentosService.obtenerPorId(documentoId);

    let propio = documento.clienteId === clienteId;
    if (!propio && documento.expedienteId) {
      const expediente = await this.expedienteRepo.findOne({ where: { id: documento.expedienteId, clienteId } });
      propio = Boolean(expediente);
    }
    if (!propio || !documento.clienteVisible || documento.eliminadoEn) {
      throw new ForbiddenException('No tienes acceso a ese documento');
    }
    const url = await this.documentosService.urlDescarga(documento);
    return { documento, url };
  }

  // --- Facturas --------------------------------------------------------------

  async estadoDeCuenta(clienteId: string) {
    return this.facturacionService.estadoDeCuenta(clienteId);
  }

  async descargarFacturaPdf(clienteId: string, facturaId: string) {
    const factura = await this.facturacionService.obtenerFactura(facturaId);
    if (factura.clienteId !== clienteId) throw new ForbiddenException('No tienes acceso a esa factura');
    const cliente = await this.clientesService.obtenerPorId(clienteId);
    const expediente = factura.expedienteId ? await this.expedienteRepo.findOne({ where: { id: factura.expedienteId } }) : null;
    const buffer = await this.pdfService.generarFacturaPdf(factura, cliente, expediente?.codigo);
    return { buffer, numero: factura.numero };
  }

  // --- Agenda / citas ----------------------------------------------------------

  async listarAgenda(clienteId: string) {
    const eventos = await this.agendaRepo.find({ where: { clienteId }, order: { fechaHoraInicio: 'ASC' } });
    return eventos.map((e) => ({
      id: e.id,
      tipo: e.tipo,
      titulo: e.titulo,
      fechaHoraInicio: e.fechaHoraInicio,
      fechaHoraFin: e.fechaHoraFin ?? null,
      estado: e.estado,
    }));
  }

  async confirmarCita(clienteId: string, eventoId: string) {
    const evento = await this.agendaRepo.findOne({ where: { id: eventoId } });
    if (!evento || evento.clienteId !== clienteId) throw new NotFoundException('Cita no encontrada');
    if (evento.estado === EstadoEventoAgenda.CANCELADO || evento.estado === EstadoEventoAgenda.COMPLETADO) {
      throw new BadRequestException('Esta cita ya no admite confirmación');
    }
    await this.agendaRepo.update(evento.id, { estado: EstadoEventoAgenda.CONFIRMADO });
    return { confirmado: true };
  }

  // --- Mensajes ----------------------------------------------------------------

  async listarMensajes(clienteId: string, expedienteId?: string) {
    if (expedienteId) await this.verificarExpedientePropio(clienteId, expedienteId);
    const mensajes = await this.mensajeRepo.find({
      where: { clienteId, ...(expedienteId ? { expedienteId } : {}) },
      order: { creadoEn: 'ASC' },
    });
    return mensajes.map((m) => ({
      id: m.id,
      expedienteId: m.expedienteId ?? null,
      remitenteTipo: m.remitenteTipo,
      contenido: m.contenido,
      creadoEn: m.creadoEn,
    }));
  }

  // --- Mensajes (lado staff) ----------------------------------------------------

  async listarMensajesStaff(clienteId: string, expedienteId?: string) {
    const mensajes = await this.mensajeRepo.find({
      where: { clienteId, ...(expedienteId ? { expedienteId } : {}) },
      order: { creadoEn: 'ASC' },
    });
    return mensajes.map((m) => ({
      id: m.id,
      expedienteId: m.expedienteId ?? null,
      remitenteTipo: m.remitenteTipo,
      remitenteId: m.remitenteId,
      contenido: m.contenido,
      leidoEn: m.leidoEn ?? null,
      creadoEn: m.creadoEn,
    }));
  }

  async enviarMensajeStaff(usuarioId: string, clienteId: string, expedienteId: string | undefined, contenido: string) {
    const mensaje = this.mensajeRepo.create({
      clienteId,
      expedienteId,
      remitenteTipo: 'staff',
      remitenteId: usuarioId,
      contenido,
    });
    return this.mensajeRepo.save(mensaje);
  }

  async enviarMensaje(clienteId: string, portalUsuarioId: string, expedienteId: string | undefined, contenido: string) {
    if (expedienteId) await this.verificarExpedientePropio(clienteId, expedienteId);
    const mensaje = this.mensajeRepo.create({
      clienteId,
      expedienteId,
      remitenteTipo: 'cliente',
      remitenteId: portalUsuarioId,
      contenido,
    });
    return this.mensajeRepo.save(mensaje);
  }
}
