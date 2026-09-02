import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { HistorialExpediente } from './historial-expediente.entity.js';

@Injectable()
export class HistorialService {
  constructor(
    @InjectRepository(HistorialExpediente)
    private readonly historialRepo: Repository<HistorialExpediente>,
  ) {}

  /**
   * Registra un cambio. Este es el ÚNICO punto de escritura de esta tabla
   * en todo el sistema — nunca se debe hacer un `update` o `delete` directo
   * contra `historial_expediente` desde ningún otro lugar del código.
   *
   * Acepta un EntityManager opcional para poder participar en la misma
   * transacción que la actualización del expediente (ver ExpedientesService)
   * sin exponer el repositorio interno a otros módulos.
   */
  async registrarCambio(
    datos: {
      expedienteId: string;
      snapshotAnterior: Record<string, any>;
      snapshotNuevo: Record<string, any>;
      usuarioId: string;
      motivo?: string;
      ipDispositivo?: string;
      esRestauracion?: boolean;
    },
    manager?: EntityManager,
  ): Promise<HistorialExpediente> {
    const repo = manager ? manager.getRepository(HistorialExpediente) : this.historialRepo;

    const camposModificados = this.calcularCamposModificados(
      datos.snapshotAnterior,
      datos.snapshotNuevo,
    );

    const entrada = repo.create({
      ...datos,
      camposModificados,
      esRestauracion: datos.esRestauracion ?? false,
    });

    return repo.save(entrada);
  }

  async listarPorExpediente(expedienteId: string): Promise<HistorialExpediente[]> {
    return this.historialRepo.find({
      where: { expedienteId },
      order: { creadoEn: 'DESC' },
    });
  }

  async obtenerVersion(historialId: string): Promise<HistorialExpediente | null> {
    return this.historialRepo.findOne({ where: { id: historialId } });
  }

  private calcularCamposModificados(
    anterior: Record<string, any>,
    nuevo: Record<string, any>,
  ): string[] {
    const campos = new Set([...Object.keys(anterior), ...Object.keys(nuevo)]);
    const modificados: string[] = [];

    for (const campo of campos) {
      const valorAnterior = JSON.stringify(anterior[campo] ?? null);
      const valorNuevo = JSON.stringify(nuevo[campo] ?? null);
      if (valorAnterior !== valorNuevo) {
        modificados.push(campo);
      }
    }

    return modificados;
  }

  // Deliberadamente NO existe un método `actualizar` ni `eliminar` en este
  // servicio — el historial es append-only por diseño (sección 7).
}
