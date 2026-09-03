import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Expediente } from './expediente.entity.js';
import { CreateExpedienteDto, UpdateExpedienteDto } from './dto/expediente.dto.js';
import {
  PREFIJO_MATERIA,
  EstadoExpediente,
  RolUsuario,
  ROLES_CON_VISIBILIDAD_TOTAL_EXPEDIENTES,
} from '../common/enums/index.js';
import { HistorialService } from '../historial/historial.service.js';
import { ExpedienteRequisitosService } from '../requisitos/expediente-requisitos.service.js';
import { Cotizacion } from '../facturacion/cotizacion.entity.js';
import { Factura } from '../facturacion/factura.entity.js';
import { Documento } from '../documentos/documento.entity.js';
import { Alerta } from '../alertas/alerta.entity.js';
import { ExpedienteRequisito } from '../requisitos/expediente-requisito.entity.js';
import { AgendaEvento } from '../agenda/agenda-evento.entity.js';
import { HistorialExpediente } from '../historial/historial-expediente.entity.js';

// Datos mínimos del usuario autenticado que necesita el control de
// visibilidad por responsable -- ver ROLES_CON_VISIBILIDAD_TOTAL_EXPEDIENTES.
export interface UsuarioActual {
  id: string;
  rol: RolUsuario;
}

@Injectable()
export class ExpedientesService {
  constructor(
    @InjectRepository(Expediente)
    private readonly expedienteRepo: Repository<Expediente>,
    private readonly historialService: HistorialService,
    private readonly requisitosService: ExpedienteRequisitosService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Genera el código único JAYM-{año}-{materia}-{secuencial}, ej.
   * JAYM-2026-CIV-0001. El secuencial es por materia y año.
   */
  private async generarCodigo(materia: keyof typeof PREFIJO_MATERIA): Promise<string> {
    const anio = new Date().getFullYear();
    const prefijo = PREFIJO_MATERIA[materia];
    const patron = `JAYM-${anio}-${prefijo}-%`;

    const ultimo = await this.expedienteRepo
      .createQueryBuilder('e')
      .where('e.codigo LIKE :patron', { patron })
      .orderBy('e.codigo', 'DESC')
      .getOne();

    let siguiente = 1;
    if (ultimo) {
      const partes = ultimo.codigo.split('-');
      siguiente = parseInt(partes[partes.length - 1], 10) + 1;
    }

    return `JAYM-${anio}-${prefijo}-${String(siguiente).padStart(4, '0')}`;
  }

  async crear(dto: CreateExpedienteDto, usuarioId: string): Promise<Expediente> {
    const codigo = await this.generarCodigo(dto.materia);

    const expediente = this.expedienteRepo.create({
      ...dto,
      codigo,
      // Si no se indica un abogado responsable explícito, el expediente
      // queda asignado a quien lo crea -- así no desaparece de su propia
      // vista en cuanto se activa el filtro por responsable (ver listar()).
      abogadoResponsableId: dto.abogadoResponsableId ?? usuarioId,
      fechaApertura: new Date().toISOString().slice(0, 10),
      etiquetas: dto.etiquetas ?? [],
    });

    const guardado = await this.expedienteRepo.save(expediente);

    // Primera entrada de historial: "estado inicial" (snapshotAnterior vacío).
    await this.historialService.registrarCambio({
      expedienteId: guardado.id,
      snapshotAnterior: {},
      snapshotNuevo: this.toSnapshot(guardado),
      usuarioId,
      motivo: 'Apertura de expediente',
    });

    // Genera el checklist de requisitos según la materia — sección 8. No
    // bloquea la creación del expediente si no hay plantillas configuradas
    // para esa materia (queda con checklist vacío, se puede completar manual).
    await this.requisitosService.generarDesdeMateria(guardado.id, dto.materia);

    return guardado;
  }

  /**
   * Un usuario sin visibilidad total (ver ROLES_CON_VISIBILIDAD_TOTAL_EXPEDIENTES)
   * solo puede ver un expediente si es su responsable asignado, o si el
   * expediente todavía no tiene responsable. Mismo criterio en listar() y
   * en actualizar() -- centralizado aquí para no repetir la regla.
   */
  private verificarVisibilidad(expediente: Expediente, usuarioActual?: UsuarioActual): void {
    if (!usuarioActual) return; // llamadas internas del sistema (sin usuario) no se restringen
    if (ROLES_CON_VISIBILIDAD_TOTAL_EXPEDIENTES.includes(usuarioActual.rol)) return;
    if (expediente.abogadoResponsableId && expediente.abogadoResponsableId !== usuarioActual.id) {
      throw new ForbiddenException('Este expediente está asignado a otro abogado responsable.');
    }
  }

  async obtenerPorId(id: string, usuarioActual?: UsuarioActual): Promise<Expediente> {
    const expediente = await this.expedienteRepo.findOne({ where: { id } });
    if (!expediente) throw new NotFoundException('Expediente no encontrado');
    this.verificarVisibilidad(expediente, usuarioActual);
    return expediente;
  }

  async listar(
    filtros: { estado?: string; materia?: string; clienteId?: string } = {},
    usuarioActual?: UsuarioActual,
  ) {
    const qb = this.expedienteRepo.createQueryBuilder('e');
    if (filtros.estado) qb.andWhere('e.estado = :estado', { estado: filtros.estado });
    if (filtros.materia) qb.andWhere('e.materia = :materia', { materia: filtros.materia });
    if (filtros.clienteId) qb.andWhere('e.clienteId = :clienteId', { clienteId: filtros.clienteId });
    // Sin visibilidad total: solo expedientes propios o todavía sin asignar
    // (sección "que cada abogado vea solo lo suyo").
    if (usuarioActual && !ROLES_CON_VISIBILIDAD_TOTAL_EXPEDIENTES.includes(usuarioActual.rol)) {
      qb.andWhere('(e.abogadoResponsableId = :miId OR e.abogadoResponsableId IS NULL)', {
        miId: usuarioActual.id,
      });
    }
    return qb.orderBy('e.actualizadoEn', 'DESC').getMany();
  }

  /**
   * REGLA OBLIGATORIA (sección 7): ninguna actualización de expediente se
   * ejecuta sin antes capturar el estado anterior en el historial. Ambas
   * escrituras ocurren en una misma transacción — si el registro de
   * historial falla, el cambio al expediente tampoco se aplica.
   */
  async actualizar(
    id: string,
    dto: UpdateExpedienteDto,
    usuarioId: string,
    ipDispositivo?: string,
    usuarioActual?: UsuarioActual,
  ): Promise<Expediente & { advertenciaDeposito?: { pendientes: unknown[] } }> {
    const actualizado = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Expediente);
      const actual = await repo.findOne({ where: { id } });
      if (!actual) throw new NotFoundException('Expediente no encontrado');
      this.verificarVisibilidad(actual, usuarioActual);

      const snapshotAnterior = this.toSnapshot(actual);
      const { motivo, ...cambios } = dto;

      repo.merge(actual, cambios);
      const guardado = await repo.save(actual);
      const snapshotNuevo = this.toSnapshot(guardado);

      // Se inserta el historial dentro de la misma transacción, pasando el
      // EntityManager transaccional al servicio de historial.
      await this.historialService.registrarCambio(
        {
          expedienteId: id,
          snapshotAnterior,
          snapshotNuevo,
          usuarioId,
          motivo,
          ipDispositivo,
        },
        manager,
      );

      return guardado;
    });

    // Advertencia NO bloqueante (sección 8): si se marca "listo para
    // depositar" con requisitos obligatorios pendientes, se informa en la
    // respuesta, pero el cambio de estado ya se aplicó — la decisión final
    // de depositar pese a la advertencia es del abogado, no del sistema.
    if (dto.estado === EstadoExpediente.LISTO_PARA_DEPOSITAR) {
      const advertencia = await this.requisitosService.obtenerAdvertenciaDeposito(id);
      if (advertencia.tieneRequisitosPendientes) {
        return { ...actualizado, advertenciaDeposito: { pendientes: advertencia.pendientes } };
      }
    }

    return actualizado;
  }

  /**
   * Restaura una versión anterior del expediente a partir de una entrada de
   * historial. Solo debe exponerse a través de un endpoint protegido para
   * el rol Superadministrador (ver RolesGuard en el controller).
   */
  async restaurarVersion(
    expedienteId: string,
    historialId: string,
    usuarioId: string,
    esSuperadmin: boolean,
  ): Promise<Expediente> {
    if (!esSuperadmin) {
      throw new ForbiddenException(
        'Solo el Superadministrador puede restaurar una versión anterior.',
      );
    }

    const version = await this.historialService.obtenerVersion(historialId);
    if (!version || version.expedienteId !== expedienteId) {
      throw new NotFoundException('Versión de historial no encontrada');
    }

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Expediente);
      const actual = await repo.findOne({ where: { id: expedienteId } });
      if (!actual) throw new NotFoundException('Expediente no encontrado');

      const snapshotAnterior = this.toSnapshot(actual);
      repo.merge(actual, version.snapshotNuevo);
      const restaurado = await repo.save(actual);

      await this.historialService.registrarCambio(
        {
          expedienteId,
          snapshotAnterior,
          snapshotNuevo: this.toSnapshot(restaurado),
          usuarioId,
          motivo: `Restauración de versión del ${version.creadoEn.toISOString()}`,
          esRestauracion: true,
        },
        manager,
      );

      return restaurado;
    });
  }

  /**
   * Elimina un expediente por completo -- pensado para corregir expedientes
   * mal instrumentados (duplicados, creados por error), no como flujo normal
   * de trabajo (el historial normal es append-only a proposito). Restringido
   * a Superadministrador desde el controlador.
   *
   * Las cotizaciones/facturas ya generadas NO se borran (son el registro
   * financiero real) -- se desvinculan del expediente (expedienteId a null)
   * para conservarlas. Si alguna factura vinculada ya tiene pagos
   * registrados, se bloquea la eliminacion por completo: hay que resolver
   * esos pagos primero (ver FacturacionService.eliminarFactura /
   * eliminarPago).
   */
  async eliminar(id: string): Promise<void> {
    await this.obtenerPorId(id); // 404 si no existe

    await this.dataSource.transaction(async (manager) => {
      const facturaRepo = manager.getRepository(Factura);
      const cotizacionRepo = manager.getRepository(Cotizacion);

      const facturasVinculadas = await facturaRepo.find({ where: { expedienteId: id } });
      const tienePagos = facturasVinculadas.some((f) => Number(f.montoPagado) > 0);
      if (tienePagos) {
        throw new BadRequestException(
          'Este expediente tiene una o mas facturas con pagos registrados -- no se puede eliminar. Resuelve o elimina esos pagos primero.',
        );
      }

      // Nota: TypeORM ignora las propiedades "undefined" en update() (las
      // trata como "no tocar este campo", no como "poner NULL") -- hay que
      // pasar null explicitamente para desvincular de verdad.
      if (facturasVinculadas.length > 0) {
        await facturaRepo.update({ expedienteId: id }, { expedienteId: null as unknown as undefined });
      }
      const cotizacionesVinculadas = await cotizacionRepo.find({ where: { expedienteId: id } });
      if (cotizacionesVinculadas.length > 0) {
        await cotizacionRepo.update({ expedienteId: id }, { expedienteId: null as unknown as undefined });
      }

      await manager.getRepository(Documento).delete({ expedienteId: id });
      await manager.getRepository(Alerta).delete({ expedienteId: id });
      await manager.getRepository(ExpedienteRequisito).delete({ expedienteId: id });
      await manager.getRepository(AgendaEvento).delete({ expedienteId: id });
      await manager.getRepository(HistorialExpediente).delete({ expedienteId: id });

      await manager.getRepository(Expediente).delete({ id });
    });
  }

  private toSnapshot(expediente: Expediente): Record<string, any> {
    // Copia plana del expediente para el historial — se excluyen las
    // relaciones cargadas (cliente) para no duplicar datos innecesariamente.
    const { ...resto } = expediente;
    return JSON.parse(JSON.stringify(resto));
  }
}
