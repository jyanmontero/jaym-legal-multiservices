import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Usuario } from './usuario.entity.js';
import { CreateUsuarioDto } from './dto/create-usuario.dto.js';
import { EstadoUsuario, RolUsuario } from '../common/enums/index.js';
import { HistorialCambiosService } from '../historial-cambios/historial-cambios.service.js';
import { CifradoService } from '../common/cifrado/cifrado.service.js';

const SALT_ROUNDS = 12;

export type UsuarioPublico = Omit<Usuario, 'passwordHash' | 'dosFactorSecreto'>;

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
    private readonly historialCambiosService: HistorialCambiosService,
    private readonly cifradoService: CifradoService,
  ) {}

  private aPublico(usuario: Usuario): UsuarioPublico {
    const { passwordHash, dosFactorSecreto, ...publico } = usuario;
    return publico;
  }

  async crear(dto: CreateUsuarioDto): Promise<UsuarioPublico> {
    const existente = await this.usuarioRepo.findOne({ where: { correo: dto.correo } });
    if (existente) {
      throw new ConflictException('Ya existe un usuario con ese correo');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const usuario = this.usuarioRepo.create({
      nombreCompleto: dto.nombreCompleto,
      correo: dto.correo,
      passwordHash,
      rol: dto.rol,
      estado: EstadoUsuario.ACTIVO,
    });

    const guardado = await this.usuarioRepo.save(usuario);
    return this.aPublico(guardado);
  }

  // Usado únicamente por AuthService para validar login — sí incluye el hash.
  // El secreto de 2FA se descifra aquí mismo (ver CifradoService) para que
  // AuthService siga trabajando con el valor real sin saber que está
  // cifrado en la base de datos.
  async buscarPorCorreoConHash(correo: string): Promise<Usuario | null> {
    const usuario = await this.usuarioRepo.findOne({ where: { correo } });
    if (usuario?.dosFactorSecreto) {
      usuario.dosFactorSecreto = this.cifradoService.descifrar(usuario.dosFactorSecreto);
    }
    return usuario;
  }

  async buscarPorId(id: string): Promise<UsuarioPublico> {
    const usuario = await this.usuarioRepo.findOne({ where: { id } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');
    return this.aPublico(usuario);
  }

  // Lista mínima (id + nombre + rol) de usuarios activos, sin correo ni
  // estado -- pensada para poblar selectores como "Abogado responsable" en
  // Expedientes, sin exponer la gestión completa de usuarios (ver
  // UsuariosController: este endpoint acepta más roles que GET /usuarios).
  async listarBasico(): Promise<{ id: string; nombreCompleto: string; rol: RolUsuario }[]> {
    const usuarios = await this.usuarioRepo.find({
      where: { estado: EstadoUsuario.ACTIVO },
      order: { nombreCompleto: 'ASC' },
    });
    return usuarios.map((u) => ({ id: u.id, nombreCompleto: u.nombreCompleto, rol: u.rol }));
  }

  async listar(): Promise<UsuarioPublico[]> {
    const usuarios = await this.usuarioRepo.find({ order: { creadoEn: 'DESC' } });
    return usuarios.map((u) => this.aPublico(u));
  }

  async marcarUltimoAcceso(id: string): Promise<void> {
    await this.usuarioRepo.update(id, { ultimoAcceso: new Date() });
  }

  async activarDosFactor(id: string, secreto: string): Promise<void> {
    await this.usuarioRepo.update(id, {
      dosFactorSecreto: this.cifradoService.cifrar(secreto),
      dosFactorActivo: true,
    });
  }

  async guardarSecretoTemporal(id: string, secreto: string): Promise<void> {
    // Se guarda antes de confirmar el primer código — dosFactorActivo
    // permanece en false hasta que el usuario verifique con éxito.
    await this.usuarioRepo.update(id, { dosFactorSecreto: this.cifradoService.cifrar(secreto) });
  }

  // El secreto se descifra antes de devolverlo -- ver nota en
  // buscarPorCorreoConHash().
  async obtenerConSecreto(id: string): Promise<Usuario> {
    const usuario = await this.usuarioRepo.findOne({ where: { id } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');
    if (usuario.dosFactorSecreto) {
      usuario.dosFactorSecreto = this.cifradoService.descifrar(usuario.dosFactorSecreto);
    }
    return usuario;
  }

  async cambiarEstado(id: string, estado: EstadoUsuario, usuarioId: string): Promise<UsuarioPublico> {
    const anterior = await this.buscarPorId(id);
    await this.usuarioRepo.update(id, { estado });
    const actualizado = await this.buscarPorId(id);
    await this.historialCambiosService.registrarCambio({
      entidadTipo: 'usuario',
      entidadId: id,
      snapshotAnterior: { estado: anterior.estado },
      snapshotNuevo: { estado: actualizado.estado },
      usuarioId,
    });
    return actualizado;
  }

  /**
   * Cambio de contraseña por un administrador (Superadministrador), sin
   * requerir la contraseña actual — para cuando un usuario la olvidó.
   */
  async resetearPassword(id: string, nuevaPassword: string, usuarioId: string): Promise<UsuarioPublico> {
    await this.buscarPorId(id); // valida que exista (lanza 404 si no)
    const passwordHash = await bcrypt.hash(nuevaPassword, SALT_ROUNDS);
    await this.usuarioRepo.update(id, { passwordHash });
    await this.historialCambiosService.registrarCambio({
      entidadTipo: 'usuario',
      entidadId: id,
      snapshotAnterior: {},
      snapshotNuevo: {},
      camposModificados: ['contraseña'],
      usuarioId,
      motivo: 'Contraseña restablecida por un administrador',
    });
    return this.buscarPorId(id);
  }

  async historial(id: string) {
    await this.buscarPorId(id); // 404 si no existe
    return this.historialCambiosService.listarPorEntidad('usuario', id);
  }

  /**
   * Cambio de contraseña por el propio usuario (self-service). Requiere
   * verificar la contraseña actual — la verificación ocurre en AuthService,
   * que llama a este método solo después de confirmarla.
   */
  async actualizarPassword(id: string, nuevaPassword: string): Promise<void> {
    const passwordHash = await bcrypt.hash(nuevaPassword, SALT_ROUNDS);
    await this.usuarioRepo.update(id, { passwordHash });
  }
}
