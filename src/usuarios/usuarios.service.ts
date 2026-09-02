import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Usuario } from './usuario.entity.js';
import { CreateUsuarioDto } from './dto/create-usuario.dto.js';
import { EstadoUsuario } from '../common/enums/index.js';

const SALT_ROUNDS = 12;

export type UsuarioPublico = Omit<Usuario, 'passwordHash' | 'dosFactorSecreto'>;

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
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
  async buscarPorCorreoConHash(correo: string): Promise<Usuario | null> {
    return this.usuarioRepo.findOne({ where: { correo } });
  }

  async buscarPorId(id: string): Promise<UsuarioPublico> {
    const usuario = await this.usuarioRepo.findOne({ where: { id } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');
    return this.aPublico(usuario);
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
      dosFactorSecreto: secreto,
      dosFactorActivo: true,
    });
  }

  async guardarSecretoTemporal(id: string, secreto: string): Promise<void> {
    // Se guarda antes de confirmar el primer código — dosFactorActivo
    // permanece en false hasta que el usuario verifique con éxito.
    await this.usuarioRepo.update(id, { dosFactorSecreto: secreto });
  }

  async obtenerConSecreto(id: string): Promise<Usuario> {
    const usuario = await this.usuarioRepo.findOne({ where: { id } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');
    return usuario;
  }

  async cambiarEstado(id: string, estado: EstadoUsuario): Promise<UsuarioPublico> {
    await this.usuarioRepo.update(id, { estado });
    return this.buscarPorId(id);
  }

  /**
   * Cambio de contraseña por un administrador (Superadministrador), sin
   * requerir la contraseña actual — para cuando un usuario la olvidó.
   */
  async resetearPassword(id: string, nuevaPassword: string): Promise<UsuarioPublico> {
    await this.buscarPorId(id); // valida que exista (lanza 404 si no)
    const passwordHash = await bcrypt.hash(nuevaPassword, SALT_ROUNDS);
    await this.usuarioRepo.update(id, { passwordHash });
    return this.buscarPorId(id);
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
