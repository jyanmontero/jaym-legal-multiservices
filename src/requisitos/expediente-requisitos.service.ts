import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExpedienteRequisito } from './expediente-requisito.entity.js';
import { RequisitosPlantillaService } from './requisitos-plantilla.service.js';
import { CrearRequisitoManualDto, ActualizarRequisitoDto } from './dto/requisito.dto.js';
import { MateriaJuridica, EstadoRequisito } from '../common/enums/index.js';

export interface ProgresoExpediente {
  porcentaje: number;
  totalObligatorios: number;
  completadosObligatorios: number;
  pendientesObligatorios: ExpedienteRequisito[];
}

@Injectable()
export class ExpedienteRequisitosService {
  constructor(
    @InjectRepository(ExpedienteRequisito)
    private readonly requisitoRepo: Repository<ExpedienteRequisito>,
    private readonly plantillaService: RequisitosPlantillaService,
  ) {}

  /**
   * Copia las plantillas activas de la materia al abrir un expediente —
   * sección 8. Se llama automáticamente desde ExpedientesService.crear().
   */
  async generarDesdeMateria(expedienteId: string, materia: MateriaJuridica): Promise<void> {
    const plantillas = await this.plantillaService.listarPorMateria(materia);
    if (plantillas.length === 0) return;

    const requisitos = plantillas.map((p) =>
      this.requisitoRepo.create({
        expedienteId,
        requisitoPlantillaId: p.id,
        nombreRequisito: p.nombreRequisito,
        descripcion: p.descripcion,
        obligatorio: p.obligatorio,
        orden: p.orden,
        estado: EstadoRequisito.PENDIENTE,
      }),
    );

    await this.requisitoRepo.save(requisitos);
  }

  async agregarManual(
    expedienteId: string,
    dto: CrearRequisitoManualDto,
  ): Promise<ExpedienteRequisito> {
    const requisito = this.requisitoRepo.create({
      expedienteId,
      nombreRequisito: dto.nombreRequisito,
      descripcion: dto.descripcion,
      obligatorio: dto.obligatorio ?? true,
      fechaPrometida: dto.fechaPrometida,
      responsableId: dto.responsableId,
      estado: EstadoRequisito.PENDIENTE,
      // requisitoPlantillaId queda nulo: es un requisito único de este caso.
    });
    return this.requisitoRepo.save(requisito);
  }

  async listarPorExpediente(expedienteId: string): Promise<ExpedienteRequisito[]> {
    return this.requisitoRepo.find({
      where: { expedienteId },
      order: { orden: 'ASC', creadoEn: 'ASC' },
    });
  }

  async obtenerPorId(id: string): Promise<ExpedienteRequisito> {
    const requisito = await this.requisitoRepo.findOne({ where: { id } });
    if (!requisito) throw new NotFoundException('Requisito no encontrado');
    return requisito;
  }

  async actualizar(id: string, dto: ActualizarRequisitoDto): Promise<ExpedienteRequisito> {
    const requisito = await this.obtenerPorId(id);

    Object.assign(requisito, dto);

    // Si se marca como completo, se registra la fecha automáticamente
    // (a menos que el estado se esté revirtiendo, en cuyo caso se limpia).
    // IMPORTANTE: .save() ignora campos `undefined` (no genera SET = NULL),
    // como se descubrió al probar el módulo de Documentos — por eso aquí se
    // usa .update() con `null` explícito para el caso de limpiar la fecha.
    if (dto.estado === EstadoRequisito.COMPLETO) {
      requisito.fechaCompletado = new Date().toISOString().slice(0, 10);
      await this.requisitoRepo.save(requisito);
    } else if (dto.estado) {
      await this.requisitoRepo.save(requisito);
      await this.requisitoRepo.update(id, { fechaCompletado: null } as any);
    } else {
      await this.requisitoRepo.save(requisito);
    }

    return this.obtenerPorId(id);
  }

  /**
   * Progreso calculado al vuelo — nunca se almacena (sección 8):
   * (obligatorios completos o no_aplica) / (total de obligatorios) × 100.
   */
  async calcularProgreso(expedienteId: string): Promise<ProgresoExpediente> {
    const requisitos = await this.listarPorExpediente(expedienteId);
    const obligatorios = requisitos.filter((r) => r.obligatorio);

    const completados = obligatorios.filter(
      (r) => r.estado === EstadoRequisito.COMPLETO || r.estado === EstadoRequisito.NO_APLICA,
    );

    const pendientes = obligatorios.filter(
      (r) => r.estado !== EstadoRequisito.COMPLETO && r.estado !== EstadoRequisito.NO_APLICA,
    );

    const porcentaje =
      obligatorios.length === 0 ? 100 : Math.round((completados.length / obligatorios.length) * 100);

    return {
      porcentaje,
      totalObligatorios: obligatorios.length,
      completadosObligatorios: completados.length,
      pendientesObligatorios: pendientes,
    };
  }

  /**
   * Advertencia (no bloqueo) al intentar marcar un expediente como
   * "listo para depositar" con requisitos obligatorios pendientes —
   * sección 8: "mostrar advertencia... la decisión final es del abogado".
   */
  async obtenerAdvertenciaDeposito(expedienteId: string): Promise<{
    tieneRequisitosPendientes: boolean;
    pendientes: ExpedienteRequisito[];
  }> {
    const progreso = await this.calcularProgreso(expedienteId);
    return {
      tieneRequisitosPendientes: progreso.pendientesObligatorios.length > 0,
      pendientes: progreso.pendientesObligatorios,
    };
  }
}
