import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { authenticator } from 'otplib';
import { UsuariosService } from '../usuarios/usuarios.service.js';
import { EstadoUsuario } from '../common/enums/index.js';
import { LoginDto } from './dto/auth.dto.js';
import { PasswordResetToken } from './password-reset-token.entity.js';
import { CorreoService } from '../notificaciones/correo.service.js';

// El enlace vale por 1 hora -- suficiente para revisar el correo sin dejar
// una ventana de riesgo demasiado grande abierta.
const HORAS_VALIDEZ_TOKEN = 1;

@Injectable()
export class AuthService {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly jwtService: JwtService,
    private readonly correoService: CorreoService,
    private readonly config: ConfigService,
    @InjectRepository(PasswordResetToken)
    private readonly resetTokenRepo: Repository<PasswordResetToken>,
  ) {}

  async login(dto: LoginDto) {
    const usuario = await this.usuariosService.buscarPorCorreoConHash(dto.correo);

    // Mensaje genérico a propósito: no revelar si el correo existe o no.
    const credencialesInvalidas = new UnauthorizedException('Credenciales inválidas');

    if (!usuario) throw credencialesInvalidas;
    if (usuario.estado !== EstadoUsuario.ACTIVO) {
      throw new UnauthorizedException('Este usuario está suspendido. Contacte al administrador.');
    }

    const passwordValido = await bcrypt.compare(dto.password, usuario.passwordHash);
    if (!passwordValido) throw credencialesInvalidas;

    if (usuario.dosFactorActivo) {
      if (!dto.codigoDosFactor) {
        // Respuesta especial: el frontend debe pedir el código y reenviar
        // el login con el mismo correo/contraseña + codigoDosFactor.
        return { requiereDosFactor: true };
      }
      const valido = authenticator.check(dto.codigoDosFactor, usuario.dosFactorSecreto!);
      if (!valido) throw new UnauthorizedException('Código de doble factor inválido');
    }

    await this.usuariosService.marcarUltimoAcceso(usuario.id);

    const payload = { sub: usuario.id, correo: usuario.correo, rol: usuario.rol };
    return {
      accessToken: await this.jwtService.signAsync(payload),
      usuario: {
        id: usuario.id,
        nombreCompleto: usuario.nombreCompleto,
        correo: usuario.correo,
        rol: usuario.rol,
      },
    };
  }

  /**
   * Paso 1 de activación de 2FA: genera un secreto TOTP y lo guarda sin
   * activarlo todavía. El usuario debe confirmarlo con confirmarDosFactor()
   * usando un código real de su app autenticadora antes de que quede activo.
   */
  async iniciarActivacionDosFactor(usuarioId: string) {
    const usuario = await this.usuariosService.obtenerConSecreto(usuarioId);
    const secreto = authenticator.generateSecret();
    await this.usuariosService.guardarSecretoTemporal(usuarioId, secreto);

    const otpauthUrl = authenticator.keyuri(usuario.correo, 'JAYM LEGAL', secreto);
    return { secreto, otpauthUrl };
  }

  async confirmarActivacionDosFactor(usuarioId: string, codigo: string) {
    const usuario = await this.usuariosService.obtenerConSecreto(usuarioId);
    if (!usuario.dosFactorSecreto) {
      throw new BadRequestException('No hay una activación de 2FA en curso para este usuario');
    }

    const valido = authenticator.check(codigo, usuario.dosFactorSecreto);
    if (!valido) throw new BadRequestException('Código incorrecto. Intenta de nuevo.');

    await this.usuariosService.activarDosFactor(usuarioId, usuario.dosFactorSecreto);
    return { dosFactorActivo: true };
  }

  /**
   * Cambio de contraseña por el propio usuario logueado. Exige la
   * contraseña actual correcta antes de permitir la nueva.
   */
  async cambiarPassword(usuarioId: string, actual: string, nueva: string) {
    const usuario = await this.usuariosService.obtenerConSecreto(usuarioId);
    const passwordValido = await bcrypt.compare(actual, usuario.passwordHash);
    if (!passwordValido) {
      throw new UnauthorizedException('La contraseña actual no es correcta');
    }
    await this.usuariosService.actualizarPassword(usuarioId, nueva);
    return { actualizado: true };
  }

  /**
   * Paso 1 de "olvidé mi contraseña": si el correo existe, genera un token
   * de un solo uso y envía el enlace por correo. La respuesta es SIEMPRE
   * la misma exista o no el correo -- a propósito, para no revelar qué
   * correos están registrados en el sistema (mismo criterio que login).
   */
  async solicitarRestablecerPassword(correo: string): Promise<{ mensaje: string }> {
    const mensaje = 'Si el correo está registrado, te enviamos un enlace para restablecer tu contraseña. Revisa tu bandeja de entrada (y spam) en los próximos minutos.';

    const usuario = await this.usuariosService.buscarPorCorreoConHash(correo);
    if (!usuario || usuario.estado !== EstadoUsuario.ACTIVO) {
      return { mensaje };
    }

    // Invalida cualquier enlace anterior sin usar -- solo el más reciente
    // debe funcionar.
    await this.resetTokenRepo.update(
      { usuarioId: usuario.id, usadoEn: IsNull() },
      { usadoEn: new Date() },
    );

    const tokenCrudo = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(tokenCrudo).digest('hex');
    const expiraEn = new Date(Date.now() + HORAS_VALIDEZ_TOKEN * 60 * 60 * 1000);

    await this.resetTokenRepo.save(
      this.resetTokenRepo.create({ usuarioId: usuario.id, tokenHash, expiraEn }),
    );

    // FRONTEND_URL puede traer varios orígenes separados por coma (ver
    // main.ts) -- para el enlace del correo se usa el primero.
    const frontendUrl = (this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173')
      .split(',')[0]
      .trim();
    const enlace = `${frontendUrl}/restablecer-password?token=${tokenCrudo}`;

    await this.correoService.enviar({
      to: usuario.correo,
      subject: 'Restablecer tu contraseña — JAYM LEGAL',
      html: `
        <p>Hola ${usuario.nombreCompleto},</p>
        <p>Recibimos una solicitud para restablecer tu contraseña en JAYM LEGAL. Haz clic en el siguiente enlace para elegir una nueva:</p>
        <p><a href="${enlace}">${enlace}</a></p>
        <p>Este enlace vale por ${HORAS_VALIDEZ_TOKEN} hora. Si no fuiste tú quien lo solicitó, puedes ignorar este correo -- tu contraseña actual sigue funcionando sin cambios.</p>
      `,
    });

    return { mensaje };
  }

  /**
   * Paso 2: valida el token (existente, no usado, no vencido) y aplica la
   * nueva contraseña. Cualquier otro enlace pendiente del mismo usuario
   * queda invalidado -- evita que un enlace viejo se pueda reutilizar
   * después de que la contraseña ya cambió por otra vía.
   */
  async restablecerPassword(tokenCrudo: string, nuevaPassword: string): Promise<{ actualizado: true }> {
    const tokenHash = crypto.createHash('sha256').update(tokenCrudo).digest('hex');
    const registro = await this.resetTokenRepo.findOne({ where: { tokenHash } });

    const enlaceInvalido = new BadRequestException(
      'Este enlace no es válido o ya expiró. Solicita uno nuevo desde "¿Olvidaste tu contraseña?".',
    );

    if (!registro || registro.usadoEn || registro.expiraEn < new Date()) {
      throw enlaceInvalido;
    }

    await this.usuariosService.actualizarPassword(registro.usuarioId, nuevaPassword);

    // Se invalida este token y cualquier otro pendiente del mismo usuario.
    await this.resetTokenRepo.update(
      { usuarioId: registro.usuarioId, usadoEn: IsNull() },
      { usadoEn: new Date() },
    );

    return { actualizado: true };
  }
}
