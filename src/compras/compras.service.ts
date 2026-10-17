import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, Repository } from 'typeorm';
import { createHash, randomUUID } from 'crypto';
import { extname } from 'path';
import { Compra, EstadoCompra, OrigenCompra } from './compra.entity.js';
import { CompraHistorial } from './compra-historial.entity.js';
import { CreateCompraDto } from './dto/compra.dto.js';
import { ExtraccionFacturaGastoService, type DatosFacturaGastoExtraidos } from './extraccion-factura-gasto.service.js';
import { AlmacenamientoService } from '../documentos/almacenamiento.service.js';
import {
  advertenciasDeCompra,
  dec,
  normalizarNcf,
  redondear2,
  soloDigitos,
  tipoIdentificacionDe,
  totalCompra,
} from './fiscal.util.js';

export interface ArchivoSubido {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

/** Resultado de leer un archivo: propuesta + avisos + posible duplicado. Nada se guarda. */
export interface PropuestaLectura {
  datos: DatosFacturaGastoExtraidos;
  advertencias: string[];
  duplicado: { id: string; proveedorNombre: string; ncf: string; fechaComprobante: string; total: string } | null;
  archivoYaCargado: boolean;
}

@Injectable()
export class ComprasService {
  constructor(
    @InjectRepository(Compra) private readonly compraRepo: Repository<Compra>,
    @InjectRepository(CompraHistorial) private readonly historialRepo: Repository<CompraHistorial>,
    private readonly extraccion: ExtraccionFacturaGastoService,
    private readonly almacenamiento: AlmacenamientoService,
    private readonly dataSource: DataSource,
  ) {}

  private sha256(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  /** Busca una compra vigente (no anulada) con el mismo proveedor y NCF. */
  async buscarDuplicado(identificacion: string, ncf: string): Promise<Compra | null> {
    const id = soloDigitos(identificacion);
    const n = normalizarNcf(ncf);
    if (!id || !n) return null;
    return this.compraRepo.findOne({
      where: { proveedorIdentificacion: id, ncf: n, estado: EstadoCompra.CONFIRMADA },
    });
  }

  /** Lee el archivo con IA y devuelve la propuesta para que una persona la revise. No guarda nada. */
  async leerArchivo(archivo: ArchivoSubido): Promise<PropuestaLectura> {
    const datos = await this.extraccion.extraer(archivo.buffer, archivo.mimetype);
    const montos = {
      montoServicios: datos.montoServicios ?? 0,
      montoBienes: datos.montoBienes ?? 0,
      itbisFacturado: datos.itbisFacturado ?? 0,
      otrosImpuestos: datos.otrosImpuestos ?? 0,
      propinaLegal: datos.propinaLegal ?? 0,
    };
    const advertencias = datos.esFacturaOComprobante
      ? advertenciasDeCompra({
          proveedorIdentificacion: datos.proveedorIdentificacion,
          ncf: datos.ncf,
          fechaComprobante: datos.fechaComprobante,
          total: datos.total,
          montos,
        })
      : ['El archivo no parece una factura o comprobante legible. Sube otra foto o registra los datos a mano.'];
    if (datos.advertencias) advertencias.unshift(datos.advertencias);

    const dup = datos.proveedorIdentificacion && datos.ncf ? await this.buscarDuplicado(datos.proveedorIdentificacion, datos.ncf) : null;
    if (dup) advertencias.unshift('Esta factura ya está registrada (mismo proveedor y NCF). No se puede registrar dos veces.');

    const yaCargado = await this.compraRepo.exists({
      where: { archivoSha256: this.sha256(archivo.buffer), estado: EstadoCompra.CONFIRMADA },
    });
    if (yaCargado) advertencias.unshift('Este mismo archivo ya fue cargado antes.');

    return {
      datos,
      advertencias,
      duplicado: dup
        ? { id: dup.id, proveedorNombre: dup.proveedorNombre, ncf: dup.ncf, fechaComprobante: dup.fechaComprobante, total: dup.total }
        : null,
      archivoYaCargado: yaCargado,
    };
  }

  /**
   * Guarda una factura de gasto ya revisada por una persona. Valida que los
   * montos cuadren con el total, rechaza duplicados (proveedor + NCF) y guarda
   * la compra, su archivo y la fila de historial juntos.
   */
  async crear(dto: CreateCompraDto, archivo: ArchivoSubido | undefined, usuarioId: string): Promise<Compra> {
    const identificacion = soloDigitos(dto.proveedorIdentificacion);
    const tipoId = tipoIdentificacionDe(identificacion);
    if (!tipoId) {
      throw new BadRequestException('El RNC debe tener 9 dígitos y la cédula 11.');
    }
    const ncf = normalizarNcf(dto.ncf);
    if (!ncf) throw new BadRequestException('El NCF es obligatorio: sin comprobante fiscal el gasto no puede ir en el 606.');

    const montos = {
      montoServicios: dto.montoServicios,
      montoBienes: dto.montoBienes,
      itbisFacturado: dto.itbisFacturado,
      isc: dto.isc ?? 0,
      otrosImpuestos: dto.otrosImpuestos ?? 0,
      propinaLegal: dto.propinaLegal ?? 0,
    };
    const calculado = totalCompra(montos);
    if (Math.abs(calculado - dto.total) > 0.05) {
      throw new BadRequestException(
        `Los montos no cuadran: servicios + bienes + ITBIS + otros suman ${calculado.toFixed(2)} y el total indicado es ${redondear2(dto.total).toFixed(2)}. Corrígelos antes de guardar.`,
      );
    }
    if ((dto.itbisAlCosto ?? 0) > dto.itbisFacturado + 0.005) {
      throw new BadRequestException('El ITBIS llevado al costo no puede ser mayor que el ITBIS facturado.');
    }
    if (dto.fechaPago && dto.fechaPago < dto.fechaComprobante) {
      throw new BadRequestException('La fecha de pago no puede ser anterior a la fecha del comprobante.');
    }
    if (dto.tipoRetencionIsr == null && (dto.retencionRenta ?? 0) > 0) {
      throw new BadRequestException('Si hay retención de renta, indica el tipo de retención.');
    }

    const dup = await this.buscarDuplicado(identificacion, ncf);
    if (dup) {
      throw new ConflictException(
        `Esta factura ya está registrada (${dup.proveedorNombre}, NCF ${dup.ncf}, RD$ ${dup.total}). Si hay un error en la anterior, anúlala con su motivo y regístrala de nuevo.`,
      );
    }

    let archivoClave: string | undefined;
    let sha: string | undefined;
    if (archivo) {
      sha = this.sha256(archivo.buffer);
      const yaCargado = await this.compraRepo.exists({ where: { archivoSha256: sha, estado: EstadoCompra.CONFIRMADA } });
      if (yaCargado) throw new ConflictException('Este mismo archivo ya fue cargado en otra factura de gasto.');
      archivoClave = `compra-${randomUUID()}${extname(archivo.originalname).toLowerCase().slice(0, 8)}`;
      await this.almacenamiento.subir(archivoClave, archivo.buffer, archivo.mimetype);
    }

    try {
      return await this.dataSource.transaction(async (manager) => {
        const compra = manager.getRepository(Compra).create({
          proveedorNombre: dto.proveedorNombre.trim(),
          proveedorIdentificacion: identificacion,
          tipoIdentificacion: tipoId,
          ncf,
          ncfModificado: dto.ncfModificado ? normalizarNcf(dto.ncfModificado) : null,
          fechaComprobante: dto.fechaComprobante.slice(0, 10),
          fechaPago: dto.fechaPago ? dto.fechaPago.slice(0, 10) : null,
          tipoBienesServicios: dto.tipoBienesServicios,
          formaPago: dto.formaPago ?? 2,
          montoServicios: dec(dto.montoServicios),
          montoBienes: dec(dto.montoBienes),
          itbisFacturado: dec(dto.itbisFacturado),
          itbisAlCosto: dec(dto.itbisAlCosto),
          itbisRetenido: dec(dto.itbisRetenido),
          tipoRetencionIsr: dto.tipoRetencionIsr ?? null,
          retencionRenta: dec(dto.retencionRenta),
          isc: dec(dto.isc),
          otrosImpuestos: dec(dto.otrosImpuestos),
          propinaLegal: dec(dto.propinaLegal),
          total: dec(dto.total),
          moneda: dto.moneda ?? 'DOP',
          concepto: dto.concepto?.trim() || undefined,
          expedienteId: dto.expedienteId ?? null,
          origen: dto.origen === 'lectura_ia' ? OrigenCompra.LECTURA_IA : OrigenCompra.MANUAL,
          archivoClave: archivoClave ?? null,
          archivoNombreOriginal: archivo?.originalname?.slice(0, 200) ?? null,
          archivoMime: archivo?.mimetype ?? null,
          archivoSha256: sha ?? null,
          estado: EstadoCompra.CONFIRMADA,
          registradaPorId: usuarioId,
        });
        const guardada = await manager.getRepository(Compra).save(compra);
        await manager.getRepository(CompraHistorial).save(
          manager.getRepository(CompraHistorial).create({
            compraId: guardada.id,
            accion: 'crear',
            snapshot: { ...guardada },
            usuarioId,
          }),
        );
        return guardada;
      });
    } catch (err) {
      // Si la base de datos falló, no dejar el archivo huérfano.
      if (archivoClave) await this.almacenamiento.eliminar(archivoClave);
      throw err;
    }
  }

  async listar(filtros: { desde?: string; hasta?: string; incluirAnuladas?: boolean }): Promise<Compra[]> {
    const where: Record<string, unknown> = {};
    if (filtros.desde && filtros.hasta) where.fechaComprobante = Between(filtros.desde, filtros.hasta);
    if (!filtros.incluirAnuladas) where.estado = EstadoCompra.CONFIRMADA;
    return this.compraRepo.find({ where, order: { fechaComprobante: 'DESC', creadoEn: 'DESC' } });
  }

  async obtener(id: string): Promise<Compra> {
    const compra = await this.compraRepo.findOneBy({ id });
    if (!compra) throw new NotFoundException('Factura de gasto no encontrada');
    return compra;
  }

  /** Anulación lógica con motivo: la factura deja de contar en los reportes pero queda en el historial. */
  async anular(id: string, motivo: string, usuarioId: string): Promise<Compra> {
    const compra = await this.obtener(id);
    if (compra.estado === EstadoCompra.ANULADA) throw new BadRequestException('Esta factura de gasto ya estaba anulada.');
    return this.dataSource.transaction(async (manager) => {
      await manager.getRepository(Compra).update(id, {
        estado: EstadoCompra.ANULADA,
        motivoAnulacion: motivo,
        anuladaEn: new Date(),
        anuladaPorId: usuarioId,
      });
      const actualizada = await manager.getRepository(Compra).findOneByOrFail({ id });
      await manager.getRepository(CompraHistorial).save(
        manager.getRepository(CompraHistorial).create({
          compraId: id,
          accion: 'anular',
          snapshot: { ...actualizada },
          motivo,
          usuarioId,
        }),
      );
      return actualizada;
    });
  }

  historial(compraId: string): Promise<CompraHistorial[]> {
    return this.historialRepo.find({ where: { compraId }, order: { creadoEn: 'ASC' } });
  }
}
