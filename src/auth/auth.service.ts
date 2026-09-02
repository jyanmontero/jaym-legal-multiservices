import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import { UsuariosService } from '../usuarios/usuarios.service.js';
import { EstadoUsuario } from '../common/enums/index.js';
import { LoginDto } from './dto/auth.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly jwtService: JwtService,
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
}
