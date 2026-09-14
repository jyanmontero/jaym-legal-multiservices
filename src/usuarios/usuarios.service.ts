import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Usuario } from './usuario.entity.js';
import { CreateUsuarioDto } from './dto/create-usuario.dto.js';
import { EstadoUsuario, RolUsuario } from '../common/enums/index.js';
import { HistorialCambiosService } from '../historial-cambios/historial-cambios.service.js';
import { CifradoService } from '../common/cifrado/cifrado.service.js';
import { parsearPaginacion, type ResultadoPaginado } from '../common/paginacion/paginacion.js';

const SALT_ROUNDS = 12;

// Clave arbitraria de 64 bits para el advisory lock de registro-inicial --
// solo tiene que ser una constante fija y estable entre despliegues, no
// significa nada fuera de este archivo.
const LOCK_REGISTRO_INICIAL = 875_501_223_001;

export type UsuarioPublico = Omit<Usuario, 'passwordHash' | 'dosFactorSecreto'>;

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
    private readonly historialCambiosService: HistorialCambiosService,
    private readonly cifradoService: CifradoService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
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

  /**
   * Usado solo por POST /auth/registro-inicial. Antes el controller
   * verificaba "¿existe algún usuario?" y creaba el superadministrador en
   * dos pasos separados sin transacción -- dos solicitudes casi simultáneas
   * en el instante exacto del primer arranque podían, en teoría, crear dos
   * superadministradores en vez de uno (hallazgo informativo de la
   * auditoría de resistencia y seguridad). El advisory lock de Postgres
   * serializa cualquier llamada concurrente a este método: la segunda
   * espera a que la primera transacción termine y entonces sí ve que ya
   * existe un usuario.
   */
  async crearPrimerSuperadministrador(dto: CreateUsuarioDto): Promise<UsuarioPublico> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock($1::bigint)', [LOCK_REGISTRO_INICIAL]);

      const yaExisteAlguno = await manager.getRepository(Usuario).exists();
      if (yaExisteAlguno) {
        throw new BadRequestException(
          'Ya existe al menos un usuario en el sistema. Use POST /usuarios (requiere sesión de Superadministrador) para crear cuentas adicionales.',
        );
      }

      const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
      const usuario = manager.getRepository(Usuario).create({
        nombreCompleto: dto.nombreCompleto,
        correo: dto.correo,
        passwordHash,
        rol: RolUsuario.SUPERADMINISTRADOR,
        estado: EstadoUsuario.ACTIVO,
      });
      const guardado = await manager.getRepository(Usuario).save(usuario);
      return this.aPublico(guardado);
    });
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

  // Sin argumento, sigue devolviendo UsuarioPublico[] completo tal cual
  // antes (así el scheduler de Google Calendar, que llama a este método sin
  // argumentos, no se ve afectado por la paginación opcional).
  async listar(): Promise<UsuarioPublico[]>;
  async listar(paginacion: { pagina?: string; porPagina?: string }): Promise<
    UsuarioPublico[] | ResultadoPaginado<UsuarioPublico>
  >;
  async listar(
    paginacion?: { pagina?: string; porPagina?: string },
  ): Promise<UsuarioPublico[] | ResultadoPaginado<UsuarioPublico>> {
    const params = parsearPaginacion(paginacion?.pagina, paginacion?.porPagina);
    if (!params) {
      const usuarios = await this.usuarioRepo.find({ order: { creadoEn: 'DESC' } });
      return usuarios.map((u) => this.aPublico(u));
    }

    const [usuarios, total] = await this.usuarioRepo.findAndCount({
      order: { creadoEn: 'DESC' },
      skip: (params.pagina - 1) * params.porPagina,
      take: params.porPagina,
    });
    return {
      datos: usuarios.map((u) => this.aPublico(u)),
      total,
      pagina: params.pagina,
      porPagina: params.porPagina,
    };
  }

  async marcarUltimoAcceso(id: string): Promise<void> {
    await this.usuarioRepo.update(id, { ultimoAcceso: new Date() });
  }

  // --- Bloqueo tras intentos fallidos de login (auditoría 14-sep-2026) ---
  // Máximo de intentos fallidos consecutivos antes de bloquear la cuenta
  // temporalmente, y cuánto dura ese bloqueo. Complementa (no reemplaza)
  // el límite de 5 intentos/minuto por IP que ya existía en el endpoint.
  private static readonly MAX_INTENTOS_FALLIDOS = 10;
  private static readonly MINUTOS_BLOQUEO = 15;

  /**
   * Si la cuenta tiene un bloqueo vigente, lo devuelve. Si el bloqueo ya
   * venció, lo limpia (junto con el contador) para que el usuario arranque
   * con intentos frescos, y devuelve null.
   */
  async obtenerBloqueoVigente(id: string): Promise<Date | null> {
    const usuario = await this.usuarioRepo.findOne({ where: { id } });
    if (!usuario?.bloqueadoHastaLogin) return null;
    if (usuario.bloqueadoHastaLogin > new Date()) {
      return usuario.bloqueadoHastaLogin;
    }
    await this.usuarioRepo.update(id, { intentosFallidosLogin: 0, bloqueadoHastaLogin: undefined });
    return null;
  }

  /**
   * Suma un intento fallido. Si llega al máximo, activa el bloqueo
   * temporal. Devuelve la fecha de bloqueo si quedó bloqueada, o null si
   * todavía le quedan intentos.
   */
  async registrarIntentoFallido(id: string): Promise<Date | null> {
    const usuario = await this.usuarioRepo.findOne({ where: { id } });
    if (!usuario) return null;
    const intentos = usuario.intentosFallidosLogin + 1;
    if (intentos >= UsuariosService.MAX_INTENTOS_FALLIDOS) {
      const bloqueadoHasta = new Date(Date.now() + UsuariosService.MINUTOS_BLOQUEO * 60 * 1000);
      await this.usuarioRepo.update(id, { intentosFallidosLogin: intentos, bloqueadoHastaLogin: bloqueadoHasta });
      return bloqueadoHasta;
    }
    await this.usuarioRepo.update(id, { intentosFallidosLogin: intentos });
    return null;
  }

  async resetearIntentosFallidos(id: string): Promise<void> {
    await this.usuarioRepo.update(id, { intentosFallidosLogin: 0, bloqueadoHastaLogin: undefined });
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
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(Usuario).update(id, { estado });
      await this.historialCambiosService.registrarCambio(
        {
          entidadTipo: 'usuario',
          entidadId: id,
          snapshotAnterior: { estado: anterior.estado },
          snapshotNuevo: { estado },
          usuarioId,
        },
        manager,
      );
    });
    return this.buscarPorId(id);
  }

  /**
   * Cambio de contraseña por un administrador (Superadministrador), sin
   * requerir la contraseña actual — para cuando un usuario la olvidó.
   */
  async resetearPassword(id: string, nuevaPassword: string, usuarioId: string): Promise<UsuarioPublico> {
    await this.buscarPorId(id); // valida que exista (lanza 404 si no)
    const passwordHash = await bcrypt.hash(nuevaPassword, SALT_ROUNDS);
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(Usuario).update(id, { passwordHash });
      await this.historialCambiosService.registrarCambio(
        {
          entidadTipo: 'usuario',
          entidadId: id,
          snapshotAnterior: {},
          snapshotNuevo: {},
          camposModificados: ['contraseña'],
          usuarioId,
          motivo: 'Contraseña restablecida por un administrador',
        },
        manager,
      );
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
