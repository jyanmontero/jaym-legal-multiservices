import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { Documento } from './documento.entity.js';
import { DocumentoPermiso } from './documento-permiso.entity.js';
import { AlmacenamientoService } from './almacenamiento.service.js';
import { SubirDocumentoDto } from './dto/subir-documento.dto.js';
import {
  RolUsuario,
  ROLES_CON_ACCESO_CONFIDENCIAL_POR_DEFECTO,
  ROLES_CON_VISIBILIDAD_TOTAL_EXPEDIENTES,
} from '../common/enums/index.js';
import { ExpedientesService, type UsuarioActual } from '../expedientes/expedientes.service.js';
import { parsearPaginacion, type ResultadoPaginado } from '../common/paginacion/paginacion.js';

export { CARPETA_ALMACENAMIENTO } from './almacenamiento.service.js';

@Injectable()
export class DocumentosService {
  constructor(
    @InjectRepository(Documento)
    private readonly documentoRepo: Repository<Documento>,
    @InjectRepository(DocumentoPermiso)
    private readonly permisoRepo: Repository<DocumentoPermiso>,
    private readonly expedientesService: ExpedientesService,
    private readonly almacenamientoService: AlmacenamientoService,
  ) {}

  async subir(
    dto: SubirDocumentoDto,
    archivo: Express.Multer.File,
    usuarioId: string,
  ): Promise<Documento> {
    if (!archivo) throw new BadRequestException('No se recibió ningún archivo');

    const clave = `${randomUUID()}${extname(archivo.originalname)}`;
    await this.almacenamientoService.subir(clave, archivo.buffer, archivo.mimetype);

    const documento = this.documentoRepo.create({
      ...dto,
      nombreArchivo: archivo.originalname,
      rutaAlmacenamiento: clave,
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

    const clave = `${randomUUID()}${extname(archivo.originalname)}`;
    await this.almacenamientoService.subir(clave, archivo.buffer, archivo.mimetype);

    const nuevaVersion = this.documentoRepo.create({
      expedienteId: anterior.expedienteId,
      clienteId: anterior.clienteId,
      carpeta: anterior.carpeta,
      categoria: anterior.categoria,
      descripcion: dto.descripcion ?? anterior.descripcion,
      nombreArchivo: archivo.originalname,
      rutaAlmacenamiento: clave,
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
  async listar(
    filtros: {
      expedienteId?: string;
      clienteId?: string;
      categoria?: string;
    },
    usuarioActual?: UsuarioActual,
    paginacion?: { pagina?: string; porPagina?: string },
  ): Promise<Documento[] | ResultadoPaginado<Documento>> {
    // Si se pide un expediente puntual, que documentos respete exactamente
    // la misma regla de visibilidad que ya se aplica al propio expediente
    // (hallazgo de la auditoría: antes esta ruta no la consultaba en
    // absoluto). Lanza 403/404 igual que GET /expedientes/:id.
    if (filtros.expedienteId) {
      await this.expedientesService.verificarVisibilidadPorId(filtros.expedienteId, usuarioActual);
    }

    const qb = this.documentoRepo
      .createQueryBuilder('d')
      .leftJoin('documentos', 'hijo', 'hijo."documentoPadreId" = d.id')
      .where('hijo.id IS NULL')
      .andWhere('d.eliminadoEn IS NULL');

    if (filtros.expedienteId) qb.andWhere('d.expedienteId = :e', { e: filtros.expedienteId });
    if (filtros.clienteId) qb.andWhere('d.clienteId = :c', { c: filtros.clienteId });
    if (filtros.categoria) qb.andWhere('d.categoria = :cat', { cat: filtros.categoria });

    // Defensa en profundidad para el listado sin filtrar por expediente
    // (ej. GET /documentos a secas): sin esto, un abogado sin visibilidad
    // total vería igual los documentos de casos ajenos con solo omitir el
    // filtro expedienteId. Mismo criterio que ExpedientesService.listar().
    if (
      !filtros.expedienteId &&
      usuarioActual &&
      !ROLES_CON_VISIBILIDAD_TOTAL_EXPEDIENTES.includes(usuarioActual.rol)
    ) {
      qb.leftJoin('expedientes', 'exp', 'exp.id = d."expedienteId"');
      qb.andWhere(
        '(d."expedienteId" IS NULL OR exp."abogadoResponsableId" = :miId OR exp."abogadoResponsableId" IS NULL)',
        { miId: usuarioActual.id },
      );
    }

    qb.orderBy('d.subidoEn', 'DESC');

    // Paginación opcional (hallazgo de la auditoría) -- sin pagina/porPagina
    // en la query, se comporta exactamente igual que antes.
    const params = parsearPaginacion(paginacion?.pagina, paginacion?.porPagina);
    if (!params) return qb.getMany();

    qb.skip((params.pagina - 1) * params.porPagina).take(params.porPagina);
    const [datos, total] = await qb.getManyAndCount();
    return { datos, total, pagina: params.pagina, porPagina: params.porPagina };
  }

  async obtenerPorId(id: string): Promise<Documento> {
    const documento = await this.documentoRepo.findOne({ where: { id } });
    if (!documento) throw new NotFoundException('Documento no encontrado');
    return documento;
  }

  /**
   * Confirma que el expediente dueño de este documento (si tiene uno) es
   * visible para el usuario actual, antes de dejarlo ver o descargar el
   * archivo. Documentos sin expedienteId (adjuntos sueltos a un cliente)
   * no tienen este control — un cliente no tiene "abogado responsable".
   */
  async verificarVisibilidadDocumento(
    documento: Documento,
    usuarioActual?: UsuarioActual,
  ): Promise<void> {
    if (!documento.expedienteId) return;
    await this.expedientesService.verificarVisibilidadPorId(documento.expedienteId, usuarioActual);
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

  /**
   * URL firmada temporal para descargar directamente desde R2, o null si se
   * está usando el disco local (en ese caso el controller usa rutaFisica()).
   */
  async urlDescarga(documento: Documento): Promise<string | null> {
    return this.almacenamientoService.urlDescarga(documento.rutaAlmacenamiento, documento.nombreArchivo);
  }

  /** Solo válido cuando no se está usando R2 (ver AlmacenamientoService). */
  rutaFisica(documento: Documento): string {
    return this.almacenamientoService.rutaLocal(documento.rutaAlmacenamiento);
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
    await this.almacenamientoService.eliminar(documento.rutaAlmacenamiento);
    await this.documentoRepo.remove(documento);
  }
}
