import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, In } from 'typeorm';
import { HistorialCambio, TipoEntidadHistorial } from './historial-cambio.entity.js';
import { Usuario } from '../usuarios/usuario.entity.js';

export interface EntradaHistorialCambio extends HistorialCambio {
  usuarioNombre: string;
}

@Injectable()
export class HistorialCambiosService {
  constructor(
    @InjectRepository(HistorialCambio)
    private readonly historialRepo: Repository<HistorialCambio>,
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
  ) {}

  /**
   * Registra un cambio. Como en `historial/historial.service.ts`, este es
   * el único punto de escritura de esta tabla — nunca se debe hacer un
   * `update` o `delete` directo contra `historial_cambios`.
   *
   * Si no se pasa `camposModificados` explícitamente, se calcula comparando
   * `snapshotAnterior` contra `snapshotNuevo`. Si de esa comparación (o de
   * la lista explícita) no resulta ningún campo modificado, no se guarda
   * nada — no vale la pena dejar una entrada vacía en el historial.
   */
  async registrarCambio(
    datos: {
      entidadTipo: TipoEntidadHistorial;
      entidadId: string;
      snapshotAnterior: Record<string, any>;
      snapshotNuevo: Record<string, any>;
      usuarioId: string;
      motivo?: string;
      camposModificados?: string[];
    },
    manager?: EntityManager,
  ): Promise<HistorialCambio | null> {
    const repo = manager ? manager.getRepository(HistorialCambio) : this.historialRepo;

    const camposModificados =
      datos.camposModificados ??
      this.calcularCamposModificados(datos.snapshotAnterior, datos.snapshotNuevo);

    if (camposModificados.length === 0) return null;

    const entrada = repo.create({
      entidadTipo: datos.entidadTipo,
      entidadId: datos.entidadId,
      snapshotAnterior: datos.snapshotAnterior,
      snapshotNuevo: datos.snapshotNuevo,
      camposModificados,
      usuarioId: datos.usuarioId,
      motivo: datos.motivo,
    });

    return repo.save(entrada);
  }

  /**
   * Lista el historial de una entidad, con el nombre del usuario que hizo
   * cada cambio ya resuelto (evita que el frontend tenga que consultar
   * `/usuarios/basico`, endpoint que no todos los roles pueden ver).
   */
  async listarPorEntidad(
    entidadTipo: TipoEntidadHistorial,
    entidadId: string,
  ): Promise<EntradaHistorialCambio[]> {
    const entradas = await this.historialRepo.find({
      where: { entidadTipo, entidadId },
      order: { creadoEn: 'DESC' },
    });
    if (entradas.length === 0) return [];

    const usuarioIds = [...new Set(entradas.map((e) => e.usuarioId))];
    const usuarios = await this.usuarioRepo.find({ where: { id: In(usuarioIds) } });
    const nombrePorId = new Map(usuarios.map((u) => [u.id, u.nombreCompleto]));

    return entradas.map((e) => ({
      ...e,
      usuarioNombre: nombrePorId.get(e.usuarioId) ?? 'Usuario eliminado',
    }));
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
  // servicio — el historial es append-only por diseño.
}
