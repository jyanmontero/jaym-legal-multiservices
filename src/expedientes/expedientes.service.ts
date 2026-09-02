import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Expediente } from './expediente.entity.js';
import { CreateExpedienteDto, UpdateExpedienteDto } from './dto/expediente.dto.js';
import { PREFIJO_MATERIA, EstadoExpediente } from '../common/enums/index.js';
import { HistorialService } from '../historial/historial.service.js';
import { ExpedienteRequisitosService } from '../requisitos/expediente-requisitos.service.js';

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

  async obtenerPorId(id: string): Promise<Expediente> {
    const expediente = await this.expedienteRepo.findOne({ where: { id } });
    if (!expediente) throw new NotFoundException('Expediente no encontrado');
    return expediente;
  }

  async listar(filtros: { estado?: string; materia?: string; clienteId?: string } = {}) {
    const qb = this.expedienteRepo.createQueryBuilder('e');
    if (filtros.estado) qb.andWhere('e.estado = :estado', { estado: filtros.estado });
    if (filtros.materia) qb.andWhere('e.materia = :materia', { materia: filtros.materia });
    if (filtros.clienteId) qb.andWhere('e.clienteId = :clienteId', { clienteId: filtros.clienteId });
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
  ): Promise<Expediente & { advertenciaDeposito?: { pendientes: unknown[] } }> {
    const actualizado = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Expediente);
      const actual = await repo.findOne({ where: { id } });
      if (!actual) throw new NotFoundException('Expediente no encontrado');

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

  private toSnapshot(expediente: Expediente): Record<string, any> {
    // Copia plana del expediente para el historial — se excluyen las
    // relaciones cargadas (cliente) para no duplicar datos innecesariamente.
    const { ...resto } = expediente;
    return JSON.parse(JSON.stringify(resto));
  }
}
