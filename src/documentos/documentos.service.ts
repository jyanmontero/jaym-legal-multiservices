import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Documento } from './documento.entity.js';
import { DocumentoPermiso } from './documento-permiso.entity.js';
import { SubirDocumentoDto } from './dto/subir-documento.dto.js';
import {
  RolUsuario,
  ROLES_CON_ACCESO_CONFIDENCIAL_POR_DEFECTO,
} from '../common/enums/index.js';

export const CARPETA_ALMACENAMIENTO = path.resolve(process.cwd(), 'storage', 'documentos');

@Injectable()
export class DocumentosService {
  constructor(
    @InjectRepository(Documento)
    private readonly documentoRepo: Repository<Documento>,
    @InjectRepository(DocumentoPermiso)
    private readonly permisoRepo: Repository<DocumentoPermiso>,
  ) {}

  async subir(
    dto: SubirDocumentoDto,
    archivo: Express.Multer.File,
    usuarioId: string,
  ): Promise<Documento> {
    if (!archivo) throw new BadRequestException('No se recibió ningún archivo');

    const documento = this.documentoRepo.create({
      ...dto,
      nombreArchivo: archivo.originalname,
      rutaAlmacenamiento: archivo.filename,
      tipoMime: archivo.mimetype,
      tamanoBytes: archivo.size,
      version: 1,
      subidoPorId: usuarioId,
    });

    return this.documentoRepo.save(documento);
  }

  /**
   * Sube una nueva versión de un documento existente. No sobrescribe la
   * fila anterior: crea una nueva con documentoPadreId apuntando a la
   * versión que se está reemplazando (sección 12).
   */
  async subirNuevaVersion(
    documentoAnteriorId: string,
    dto: Pick<SubirDocumentoDto, 'descripcion' | 'fechaVencimiento'>,
    archivo: Express.Multer.File,
    usuarioId: string,
  ): Promise<Documento> {
    const anterior = await this.obtenerPorId(documentoAnteriorId);

    if (!archivo) throw new BadRequestException('No se recibió ningún archivo');

    const nuevaVersion = this.documentoRepo.create({
      expedienteId: anterior.expedienteId,
      clienteId: anterior.clienteId,
      carpeta: anterior.carpeta,
      categoria: anterior.categoria,
      descripcion: dto.descripcion ?? anterior.descripcion,
      nombreArchivo: archivo.originalname,
      rutaAlmacenamiento: archivo.filename,
      tipoMime: archivo.mimetype,
      tamanoBytes: archivo.size,
      version: anterior.version + 1,
      documentoPadreId: anterior.id,
      confidencial: anterior.confidencial,
      clienteVisible: anterior.clienteVisible,
      fechaVencimiento: dto.fechaVencimiento ?? anterior.fechaVencimiento,
      subidoPorId: usuarioId,
    });

    return this.documentoRepo.save(nuevaVersion);
  }

  /**
   * Lista solo la versión vigente de cada documento: aquella a la que
   * ninguna otra fila apunta como `documentoPadreId`, y que no está en
   * la papelera.
   */
  async listar(filtros: {
    expedienteId?: string;
    clienteId?: string;
    categoria?: string;
  }): Promise<Documento[]> {
    const qb = this.documentoRepo
      .createQueryBuilder('d')
      .leftJoin('documentos', 'hijo', 'hijo."documentoPadreId" = d.id')
      .where('hijo.id IS NULL')
      .andWhere('d.eliminadoEn IS NULL');

    if (filtros.expedienteId) qb.andWhere('d.expedienteId = :e', { e: filtros.expedienteId });
    if (filtros.clienteId) qb.andWhere('d.clienteId = :c', { c: filtros.clienteId });
    if (filtros.categoria) qb.andWhere('d.categoria = :cat', { cat: filtros.categoria });

    return qb.orderBy('d.subidoEn', 'DESC').getMany();
  }

  async obtenerPorId(id: string): Promise<Documento> {
    const documento = await this.documentoRepo.findOne({ where: { id } });
    if (!documento) throw new NotFoundException('Documento no encontrado');
    return documento;
  }

  /** Devuelve toda la cadena de versiones de un documento, más reciente primero. */
  async listarVersiones(documentoId: string): Promise<Documento[]> {
    // Encontrar la raíz de la cadena subiendo por documentoPadreId.
    let actual = await this.obtenerPorId(documentoId);
    while (actual.documentoPadreId) {
      actual = await this.obtenerPorId(actual.documentoPadreId);
    }
    const raizId = actual.id;

    // Recolectar todas las versiones descendientes de la raíz.
    const versiones: Documento[] = [actual];
    let colaIds = [raizId];
    while (colaIds.length > 0) {
      const hijos = await this.documentoRepo.find({
        where: colaIds.map((id) => ({ documentoPadreId: id })),
      });
      versiones.push(...hijos);
      colaIds = hijos.map((h) => h.id);
    }

    return versiones.sort((a, b) => b.version - a.version);
  }

  async listarPapelera(): Promise<Documento[]> {
    return this.documentoRepo
      .createQueryBuilder('d')
      .where('d.eliminadoEn IS NOT NULL')
      .orderBy('d.eliminadoEn', 'DESC')
      .getMany();
  }

  /**
   * Verifica si un rol puede ver/descargar un documento marcado como
   * confidencial. Los documentos no confidenciales son visibles para
   * cualquier usuario interno autenticado.
   */
  async verificarAcceso(
    documento: Documento,
    rol: RolUsuario,
    accion: 'ver' | 'descargar',
  ): Promise<void> {
    if (!documento.confidencial) return;

    if (ROLES_CON_ACCESO_CONFIDENCIAL_POR_DEFECTO.includes(rol)) return;

    const permiso = await this.permisoRepo.findOne({
      where: { documentoId: documento.id, rol },
    });

    const permitido = accion === 'ver' ? permiso?.puedeVer : permiso?.puedeDescargar;

    if (!permitido) {
      throw new ForbiddenException(
        'Este documento es confidencial y su rol no tiene permiso para acceder a él.',
      );
    }
  }

  async rutaFisica(documento: Documento): Promise<string> {
    return path.join(CARPETA_ALMACENAMIENTO, documento.rutaAlmacenamiento);
  }

  /** Papelera recuperable — nunca borra el archivo ni la fila (sección 12). */
  async eliminar(id: string, usuarioId: string): Promise<Documento> {
    const documento = await this.obtenerPorId(id);
    if (documento.eliminadoEn) {
      throw new BadRequestException('El documento ya está en la papelera');
    }
    documento.eliminadoEn = new Date();
    documento.eliminadoPorId = usuarioId;
    return this.documentoRepo.save(documento);
  }

  async restaurar(id: string): Promise<Documento> {
    const documento = await this.obtenerPorId(id);
    if (!documento.eliminadoEn) {
      throw new BadRequestException('El documento no está en la papelera');
    }
    // IMPORTANTE: .save() ignora campos `undefined` (no genera SET = NULL).
    // Hay que usar .update() con `null` explícito para limpiar la columna.
    await this.documentoRepo.update(id, { eliminadoEn: null, eliminadoPorId: null } as any);
    return this.obtenerPorId(id);
  }

  /**
   * Purga definitiva — solo Superadministrador (verificado en el
   * controller). Esta es la única operación que sí borra el archivo físico
   * y la fila; todo lo demás en este servicio es reversible.
   */
  async purgarDefinitivamente(id: string): Promise<void> {
    const documento = await this.obtenerPorId(id);
    if (!documento.eliminadoEn) {
      throw new BadRequestException('Solo se puede purgar un documento que ya esté en la papelera');
    }
    const ruta = await this.rutaFisica(documento);
    await fs.unlink(ruta).catch(() => undefined); // tolerante si el archivo ya no existe
    await this.documentoRepo.remove(documento);
  }
}
