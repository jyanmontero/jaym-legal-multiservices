import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cliente } from '../clientes/cliente.entity.js';
import { Expediente } from '../expedientes/expediente.entity.js';
import { TipoCliente, EstadoCotizacion, EstadoFactura } from '../common/enums/index.js';
import { CorreoService } from '../notificaciones/correo.service.js';
import { FacturacionService } from './facturacion.service.js';
import { PdfService } from './pdf/pdf.service.js';
import { ComunicacionCobro } from './comunicacion-cobro.entity.js';
import type { EnviarCobroCorreoDto, RegistrarWhatsappDto, TipoCobro } from './dto/cobros.dto.js';
import {
  balancePendiente,
  construirAsuntoYMensaje,
  construirMensajeWhatsapp,
  normalizarTelefonoRD,
  parsearDestinatarios,
  textoAHtml,
  type DatosCobro,
} from './cobros.util.js';

function nombreCliente(c: Cliente): string {
  return c.tipo === TipoCliente.JURIDICO
    ? (c.razonSocial ?? c.nombreComercial ?? '')
    : `${c.nombres ?? ''} ${c.apellidos ?? ''}`.trim();
}

interface DocumentoCobro {
  datos: DatosCobro;
  cliente: Cliente;
  expedienteId?: string;
  facturaId?: string;
  cotizacionId?: string;
  numero: string;
  pdf: () => Promise<Buffer>;
}

/**
 * Envío de cotizaciones, facturas y recordatorios de cobro al cliente por
 * correo (con el PDF adjunto) o WhatsApp (mensaje listo; la persona pulsa
 * enviar). Regla de la firma: todo envío pasa por revisión humana -- el
 * sistema redacta el borrador, pero nada sale sin que alguien lo confirme.
 * El contenido sale solo de los datos del documento: nunca notas internas.
 */
@Injectable()
export class CobrosService {
  constructor(
    @InjectRepository(ComunicacionCobro) private readonly repo: Repository<ComunicacionCobro>,
    @InjectRepository(Cliente) private readonly clienteRepo: Repository<Cliente>,
    @InjectRepository(Expediente) private readonly expedienteRepo: Repository<Expediente>,
    private readonly facturacion: FacturacionService,
    private readonly pdfService: PdfService,
    private readonly correo: CorreoService,
  ) {}

  private async cargar(tipo: TipoCobro, id: string): Promise<DocumentoCobro> {
    const hoyIso = new Date().toISOString().slice(0, 10);
    if (tipo === 'cotizacion') {
      const cot = await this.facturacion.obtenerCotizacion(id);
      const cliente = await this.clienteRepo.findOne({ where: { id: cot.clienteId } });
      if (!cliente) throw new NotFoundException('Cliente no encontrado.');
      const exp = cot.expedienteId ? await this.expedienteRepo.findOne({ where: { id: cot.expedienteId } }) : null;
      return {
        datos: {
          tipo,
          nombreCliente: nombreCliente(cliente),
          numero: cot.numero,
          concepto: cot.concepto,
          total: cot.total,
          validaHasta: cot.validaHasta,
          hoyIso,
        },
        cliente,
        expedienteId: cot.expedienteId ?? undefined,
        cotizacionId: cot.id,
        numero: cot.numero,
        pdf: () => this.pdfService.generarCotizacionPdf(cot, cliente, exp?.codigo),
      };
    }

    const fac = await this.facturacion.obtenerFactura(id);
    if (fac.estado === EstadoFactura.ANULADA) {
      throw new BadRequestException('Esta factura está anulada: no se puede enviar ni cobrar.');
    }
    const cliente = await this.clienteRepo.findOne({ where: { id: fac.clienteId } });
    if (!cliente) throw new NotFoundException('Cliente no encontrado.');
    const exp = fac.expedienteId ? await this.expedienteRepo.findOne({ where: { id: fac.expedienteId } }) : null;
    const datos: DatosCobro = {
      tipo,
      nombreCliente: nombreCliente(cliente),
      numero: fac.numero,
      concepto: fac.concepto,
      total: fac.total,
      montoPagado: fac.montoPagado,
      fechaVencimiento: fac.fechaVencimiento,
      enlacePago: fac.enlacePago,
      hoyIso,
    };
    if (tipo === 'recordatorio' && balancePendiente(datos) <= 0) {
      throw new BadRequestException('Esta factura no tiene balance pendiente: no hace falta recordatorio.');
    }
    return {
      datos,
      cliente,
      expedienteId: fac.expedienteId ?? undefined,
      facturaId: fac.id,
      numero: fac.numero,
      pdf: () => this.pdfService.generarFacturaPdf(fac, cliente, exp?.codigo),
    };
  }

  private telefonoWhatsapp(cliente: Cliente): { normalizado: string | null; original: string | null } {
    const lista = cliente.telefonos ?? [];
    for (const t of lista) {
      const n = normalizarTelefonoRD(t);
      if (n) return { normalizado: n, original: t };
    }
    return { normalizado: null, original: lista[0] ?? null };
  }

  async borrador(tipo: TipoCobro, id: string) {
    const doc = await this.cargar(tipo, id);
    const { asunto, mensaje } = construirAsuntoYMensaje(doc.datos);
    const tel = this.telefonoWhatsapp(doc.cliente);
    return {
      tipo,
      documentoId: id,
      numero: doc.numero,
      cliente: { id: doc.cliente.id, nombre: doc.datos.nombreCliente },
      para: doc.cliente.correo ?? '',
      asunto,
      mensaje,
      adjuntoNombre: `${doc.numero}.pdf`,
      smtpConfigurado: this.correo.estaConfigurado(),
      whatsapp: {
        telefono: tel.normalizado,
        telefonoOriginal: tel.original,
        mensaje: construirMensajeWhatsapp(doc.datos),
      },
    };
  }

  async enviarCorreo(dto: EnviarCobroCorreoDto, usuarioId: string) {
    const destinatarios = parsearDestinatarios(dto.para);
    if (!destinatarios) {
      throw new BadRequestException('Escribe de 1 a 5 correos válidos, separados por coma.');
    }
    if (!this.correo.estaConfigurado()) {
      throw new BadRequestException(
        'El correo saliente todavía no está configurado en el sistema (variables SMTP en Render). No se envió nada.',
      );
    }
    const doc = await this.cargar(dto.tipo, dto.id);
    const pdf = await doc.pdf();
    const nombrePdf = `${doc.numero}.pdf`;

    const resultado = await this.correo.enviarDetallado({
      to: destinatarios.join(', '),
      subject: dto.asunto.trim(),
      html: textoAHtml(dto.mensaje),
      attachments: [{ filename: nombrePdf, content: pdf, contentType: 'application/pdf' }],
    });

    const registro = await this.repo.save(
      this.repo.create({
        tipo: dto.tipo,
        canal: 'correo',
        clienteId: doc.cliente.id,
        expedienteId: doc.expedienteId,
        facturaId: doc.facturaId,
        cotizacionId: doc.cotizacionId,
        destinatario: destinatarios.join(', '),
        asunto: dto.asunto.trim(),
        contenido: dto.mensaje,
        adjunto: nombrePdf,
        estado: resultado.ok ? 'enviado' : 'fallido',
        error: resultado.error,
        enviadoPorId: usuarioId,
      }),
    );

    if (!resultado.ok) {
      throw new BadRequestException(`No se pudo enviar el correo. ${resultado.error ?? ''}`.trim());
    }

    // Una cotización que sale al cliente deja de ser borrador.
    if (dto.tipo === 'cotizacion') {
      const cot = await this.facturacion.obtenerCotizacion(dto.id);
      if (cot.estado === EstadoCotizacion.BORRADOR) {
        await this.facturacion.cambiarEstadoCotizacion(dto.id, EstadoCotizacion.ENVIADA);
      }
    }
    return registro;
  }

  async registrarWhatsapp(dto: RegistrarWhatsappDto, usuarioId: string) {
    const telefono = normalizarTelefonoRD(dto.telefono);
    if (!telefono) {
      throw new BadRequestException('El teléfono no parece un número dominicano válido (809, 829 o 849).');
    }
    const doc = await this.cargar(dto.tipo, dto.id);
    return this.repo.save(
      this.repo.create({
        tipo: dto.tipo,
        canal: 'whatsapp',
        clienteId: doc.cliente.id,
        expedienteId: doc.expedienteId,
        facturaId: doc.facturaId,
        cotizacionId: doc.cotizacionId,
        destinatario: telefono,
        contenido: dto.mensaje,
        estado: 'abierto',
        enviadoPorId: usuarioId,
      }),
    );
  }

  async historial(filtros: { facturaId?: string; cotizacionId?: string; clienteId?: string }) {
    if (!filtros.facturaId && !filtros.cotizacionId && !filtros.clienteId) {
      throw new BadRequestException('Indica la factura, la cotización o el cliente.');
    }
    const where: Record<string, string> = {};
    if (filtros.facturaId) where.facturaId = filtros.facturaId;
    if (filtros.cotizacionId) where.cotizacionId = filtros.cotizacionId;
    if (filtros.clienteId) where.clienteId = filtros.clienteId;
    return this.repo.find({ where, order: { creadoEn: 'DESC' }, take: 50 });
  }
}
