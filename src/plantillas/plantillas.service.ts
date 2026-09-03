import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes, randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import { SolicitudDocumento } from './solicitud-documento.entity.js';
import { Documento } from '../documentos/documento.entity.js';
import { Cliente } from '../clientes/cliente.entity.js';
import { CARPETA_ALMACENAMIENTO } from '../documentos/documentos.service.js';
import { CrearSolicitudDocumentoDto } from './dto/crear-solicitud.dto.js';
import { CompletarSolicitudDto } from './dto/completar-solicitud.dto.js';
import { RevisarSolicitudDocumentoDto } from './dto/revisar-solicitud.dto.js';
import {
  CATALOGO_PLANTILLAS,
  obtenerPlantilla,
  camposFaltantes,
  renderizarCuerpo,
} from './plantillas-catalogo.js';
import { PlantillaPdfService } from './pdf/plantilla-pdf.service.js';
import { EstadoSolicitudDocumento, CategoriaDocumento, TipoCliente } from '../common/enums/index.js';

@Injectable()
export class PlantillasService {
  constructor(
    @InjectRepository(SolicitudDocumento)
    private readonly solicitudRepo: Repository<SolicitudDocumento>,
    @InjectRepository(Documento)
    private readonly documentoRepo: Repository<Documento>,
    @InjectRepository(Cliente)
    private readonly clienteRepo: Repository<Cliente>,
    private readonly pdfService: PlantillaPdfService,
  ) {}

  listarCatalogo() {
    return CATALOGO_PLANTILLAS.map(({ clave, nombre, descripcion, campos }) => ({
      clave,
      nombre,
      descripcion,
      campos,
    }));
  }

  private generarToken(): string {
    return randomBytes(24).toString('base64url');
  }

  private construirEnlacePublico(token: string): string {
    const base = (process.env.FRONTEND_URL ?? 'http://localhost:5173').split(',')[0].trim();
    return `${base}/firmar/${token}`;
  }

  async crear(dto: CrearSolicitudDocumentoDto, usuarioId: string) {
    const plantilla = obtenerPlantilla(dto.plantillaClave);
    if (!plantilla) throw new BadRequestException('Plantilla no encontrada');

    if (dto.clienteId) {
      const existe = await this.clienteRepo.findOne({ where: { id: dto.clienteId } });
      if (!existe) throw new BadRequestException('El cliente indicado no existe');
    }

    const solicitud = this.solicitudRepo.create({
      plantillaClave: dto.plantillaClave,
      expedienteId: dto.expedienteId,
      clienteId: dto.clienteId,
      datos: dto.datosPrellenados ?? {},
      notasInternas: dto.notasInternas,
      tokenAcceso: this.generarToken(),
      creadoPorId: usuarioId,
    });
    const guardada = await this.solicitudRepo.save(solicitud);
    return { solicitud: guardada, enlacePublico: this.construirEnlacePublico(guardada.tokenAcceso) };
  }

  async listar(filtros: { estado?: string; expedienteId?: string; clienteId?: string }) {
    const where: Record<string, string> = {};
    if (filtros.estado) where.estado = filtros.estado;
    if (filtros.expedienteId) where.expedienteId = filtros.expedienteId;
    if (filtros.clienteId) where.clienteId = filtros.clienteId;
    return this.solicitudRepo.find({ where, order: { creadoEn: 'DESC' } });
  }

  async obtener(id: string): Promise<SolicitudDocumento> {
    const solicitud = await this.solicitudRepo.findOne({ where: { id } });
    if (!solicitud) throw new NotFoundException('Solicitud no encontrada');
    return solicitud;
  }

  async obtenerConPlantilla(id: string) {
    const solicitud = await this.obtener(id);
    const plantilla = obtenerPlantilla(solicitud.plantillaClave);
    return {
      solicitud,
      plantilla,
      enlacePublico: this.construirEnlacePublico(solicitud.tokenAcceso),
    };
  }

  // --- Acceso público (sin autenticación), vía token -----------------

  async obtenerPorToken(token: string) {
    const solicitud = await this.solicitudRepo.findOne({ where: { tokenAcceso: token } });
    if (!solicitud) throw new NotFoundException('Enlace no válido o expirado');
    const plantilla = obtenerPlantilla(solicitud.plantillaClave);
    if (!plantilla) throw new NotFoundException('Enlace no válido o expirado');

    return {
      plantilla: { nombre: plantilla.nombre, descripcion: plantilla.descripcion, campos: plantilla.campos },
      datos: solicitud.datos,
      estado: solicitud.estado,
      motivoRechazo:
        solicitud.estado === EstadoSolicitudDocumento.PENDIENTE_CLIENTE ? solicitud.motivoRechazo : undefined,
    };
  }

  async completarPorToken(token: string, dto: CompletarSolicitudDto) {
    const solicitud = await this.solicitudRepo.findOne({ where: { tokenAcceso: token } });
    if (!solicitud) throw new NotFoundException('Enlace no válido o expirado');
    if (solicitud.estado !== EstadoSolicitudDocumento.PENDIENTE_CLIENTE) {
      throw new BadRequestException('Este documento ya fue enviado y está en revisión, o ya fue aprobado.');
    }
    const plantilla = obtenerPlantilla(solicitud.plantillaClave);
    if (!plantilla) throw new NotFoundException('Enlace no válido o expirado');

    const datosFinales = { ...solicitud.datos, ...dto.datos };
    const faltantes = camposFaltantes(plantilla, datosFinales);
    if (faltantes.length > 0) {
      throw new BadRequestException(`Faltan campos obligatorios: ${faltantes.join(', ')}`);
    }

    solicitud.datos = datosFinales;
    solicitud.estado = EstadoSolicitudDocumento.PENDIENTE_APROBACION;
    solicitud.completadoEn = new Date();
    solicitud.motivoRechazo = null;
    await this.solicitudRepo.save(solicitud);
    return { recibido: true };
  }

  // --- Revisión interna ------------------------------------------------

  async revisar(id: string, dto: RevisarSolicitudDocumentoDto, usuarioId: string): Promise<SolicitudDocumento> {
    const solicitud = await this.obtener(id);
    if (solicitud.estado !== EstadoSolicitudDocumento.PENDIENTE_APROBACION) {
      throw new BadRequestException(
        'Solo se pueden revisar solicitudes que el cliente ya completó y están pendientes de aprobación.',
      );
    }
    const plantilla = obtenerPlantilla(solicitud.plantillaClave);
    if (!plantilla) throw new NotFoundException('Plantilla no encontrada');

    if (dto.datosCorregidos) {
      solicitud.datos = { ...solicitud.datos, ...dto.datosCorregidos };
    }

    if (!dto.aprobar) {
      solicitud.estado = EstadoSolicitudDocumento.PENDIENTE_CLIENTE;
      solicitud.motivoRechazo =
        dto.motivoRechazo || 'Se solicitaron correcciones a este documento. Por favor revisa y vuelve a enviarlo.';
      solicitud.completadoEn = null;
      solicitud.revisadoEn = new Date();
      solicitud.revisadoPorId = usuarioId;
      return this.solicitudRepo.save(solicitud);
    }

    const faltantes = camposFaltantes(plantilla, solicitud.datos);
    if (faltantes.length > 0) {
      throw new BadRequestException(`No se puede aprobar: faltan campos obligatorios: ${faltantes.join(', ')}`);
    }

    const cuerpo = renderizarCuerpo(plantilla, solicitud.datos);
    const buffer = await this.pdfService.generarDocumentoPdf(plantilla.nombre, cuerpo);

    const nombreArchivoDisco = `${randomUUID()}.pdf`;
    await fs.mkdir(CARPETA_ALMACENAMIENTO, { recursive: true });
    await fs.writeFile(`${CARPETA_ALMACENAMIENTO}/${nombreArchivoDisco}`, buffer);

    const nombreCliente = await this.nombreClienteParaArchivo(solicitud.clienteId);
    const documento = this.documentoRepo.create({
      expedienteId: solicitud.expedienteId,
      clienteId: solicitud.clienteId,
      carpeta: 'Contratos generados',
      categoria: CategoriaDocumento.CONTRATOS,
      nombreArchivo: `${plantilla.nombre}${nombreCliente ? ' - ' + nombreCliente : ''}.pdf`,
      rutaAlmacenamiento: nombreArchivoDisco,
      tipoMime: 'application/pdf',
      tamanoBytes: buffer.length,
      version: 1,
      subidoPorId: usuarioId,
    });
    const documentoGuardado = await this.documentoRepo.save(documento);

    solicitud.estado = EstadoSolicitudDocumento.APROBADO;
    solicitud.documentoGeneradoId = documentoGuardado.id;
    solicitud.revisadoEn = new Date();
    solicitud.revisadoPorId = usuarioId;
    solicitud.motivoRechazo = null;
    return this.solicitudRepo.save(solicitud);
  }

  private async nombreClienteParaArchivo(clienteId?: string): Promise<string | null> {
    if (!clienteId) return null;
    const cliente = await this.clienteRepo.findOne({ where: { id: clienteId } });
    if (!cliente) return null;
    return cliente.tipo === TipoCliente.JURIDICO
      ? (cliente.razonSocial ?? cliente.nombreComercial ?? '')
      : `${cliente.nombres ?? ''} ${cliente.apellidos ?? ''}`.trim();
  }
}
