import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { SeguimientoExpediente } from './seguimiento-expediente.entity.js';
import { CrearSeguimientoDto } from './dto/seguimiento.dto.js';
import { Usuario } from '../usuarios/usuario.entity.js';

export type SeguimientoConAutor = SeguimientoExpediente & { usuarioNombre: string };

@Injectable()
export class SeguimientoService {
  constructor(
    @InjectRepository(SeguimientoExpediente)
    private readonly seguimientoRepo: Repository<SeguimientoExpediente>,
    // Solo para resolver el nombre del autor de cada entrada -- el listado
    // de usuarios en sí (/usuarios/basico) está restringido a roles
    // administrativos, pero cualquiera con acceso al expediente debe poder
    // ver quién escribió cada nota de seguimiento, sin importar su rol.
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
  ) {}

  async listarPorExpediente(expedienteId: string): Promise<SeguimientoConAutor[]> {
    // Orden ascendente -- se lee como una línea de tiempo, de la apertura
    // del caso hacia el presente.
    const entradas = await this.seguimientoRepo.find({
      where: { expedienteId },
      order: { creadoEn: 'ASC' },
    });
    return this.enriquecerConAutor(entradas);
  }

  async crear(
    expedienteId: string,
    dto: CrearSeguimientoDto,
    usuarioId: string,
  ): Promise<SeguimientoConAutor> {
    const entrada = this.seguimientoRepo.create({
      expedienteId,
      usuarioId,
      texto: dto.texto,
      hito: dto.hito ?? false,
    });
    const guardada = await this.seguimientoRepo.save(entrada);
    const [conAutor] = await this.enriquecerConAutor([guardada]);
    return conAutor;
  }

  private async enriquecerConAutor(entradas: SeguimientoExpediente[]): Promise<SeguimientoConAutor[]> {
    if (entradas.length === 0) return [];
    const idsUnicos = [...new Set(entradas.map((e) => e.usuarioId))];
    const usuarios = await this.usuarioRepo.findBy({ id: In(idsUnicos) });
    const nombrePorId = new Map(usuarios.map((u) => [u.id, u.nombreCompleto]));
    return entradas.map((e) => ({ ...e, usuarioNombre: nombrePorId.get(e.usuarioId) ?? 'Usuario' }));
  }

  // Deliberadamente NO existe un método `actualizar` ni `eliminar` -- la
  // bitácora de seguimiento es append-only, igual que el historial de
  // cambios (ver HistorialService).
}
