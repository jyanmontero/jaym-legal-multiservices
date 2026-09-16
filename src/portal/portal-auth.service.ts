import { Injectable, UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PortalUsuario } from './portal-usuario.entity.js';
import { PortalPasswordResetToken } from './portal-password-reset-token.entity.js';
import { LoginPortalDto } from './dto/portal-auth.dto.js';
import { CorreoService } from '../notificaciones/correo.service.js';

const HORAS_VALIDEZ_TOKEN = 1;
const MINUTOS_BLOQUEO = 15;
const INTENTOS_MAXIMOS = 10;

export interface JwtPayloadPortal {
  sub: string; // id del PortalUsuario
  correo: string;
  clienteId: string;
  tipo: 'portal';
}

@Injectable()
export class PortalAuthService {
  constructor(
    @InjectRepository(PortalUsuario) private readonly portalUsuarioRepo: Repository<PortalUsuario>,
    @InjectRepository(PortalPasswordResetToken) private readonly resetTokenRepo: Repository<PortalPasswordResetToken>,
    private readonly jwtService: JwtService,
    private readonly correoService: CorreoService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginPortalDto) {
    const cuenta = await this.portalUsuarioRepo.findOne({ where: { correo: dto.correo } });
    const credencialesInvalidas = new UnauthorizedException('Credenciales inválidas');

    if (!cuenta) throw credencialesInvalidas;
    if (!cuenta.activo) {
      throw new UnauthorizedException('Este acceso está desactivado. Contacta a la firma.');
    }
    if (cuenta.bloqueadoHastaLogin && cuenta.bloqueadoHastaLogin > new Date()) {
      const minutosRestantes = Math.ceil((cuenta.bloqueadoHastaLogin.getTime() - Date.now()) / 60000);
      throw new UnauthorizedException(
        `Esta cuenta quedó bloqueada temporalmente por varios intentos fallidos. Intenta de nuevo en ${minutosRestantes} minuto(s).`,
      );
    }

    const passwordValido = await bcrypt.compare(dto.password, cuenta.passwordHash);
    if (!passwordValido) {
      const intentos = cuenta.intentosFallidosLogin + 1;
      await this.portalUsuarioRepo.update(cuenta.id, {
        intentosFallidosLogin: intentos,
        bloqueadoHastaLogin: intentos >= INTENTOS_MAXIMOS ? new Date(Date.now() + MINUTOS_BLOQUEO * 60000) : cuenta.bloqueadoHastaLogin,
      });
      throw credencialesInvalidas;
    }

    await this.portalUsuarioRepo.update(cuenta.id, {
      ultimoAcceso: new Date(),
      intentosFallidosLogin: 0,
      bloqueadoHastaLogin: undefined,
    });

    const payload: JwtPayloadPortal = { sub: cuenta.id, correo: cuenta.correo, clienteId: cuenta.clienteId, tipo: 'portal' };
    return {
      accessToken: await this.jwtService.signAsync(payload),
      usuario: {
        id: cuenta.id,
        nombreCompleto: cuenta.nombreCompleto,
        correo: cuenta.correo,
        clienteId: cuenta.clienteId,
        debeCambiarPassword: cuenta.debeCambiarPassword,
      },
    };
  }

  async cambiarPassword(portalUsuarioId: string, actual: string, nueva: string) {
    const cuenta = await this.portalUsuarioRepo.findOne({ where: { id: portalUsuarioId } });
    if (!cuenta) throw new ForbiddenException();
    const valido = await bcrypt.compare(actual, cuenta.passwordHash);
    if (!valido) throw new UnauthorizedException('La contraseña actual no es correcta');
    const passwordHash = await bcrypt.hash(nueva, 12);
    await this.portalUsuarioRepo.update(cuenta.id, { passwordHash, debeCambiarPassword: false });
    return { actualizado: true };
  }

  async solicitarReset(correo: string): Promise<{ mensaje: string }> {
    const mensaje = 'Si el correo está registrado en un portal de cliente, te enviamos un enlace para restablecer tu contraseña.';
    const cuenta = await this.portalUsuarioRepo.findOne({ where: { correo } });
    if (!cuenta || !cuenta.activo) return { mensaje };

    await this.resetTokenRepo.update({ portalUsuarioId: cuenta.id, usadoEn: IsNull() }, { usadoEn: new Date() });

    const tokenCrudo = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(tokenCrudo).digest('hex');
    const expiraEn = new Date(Date.now() + HORAS_VALIDEZ_TOKEN * 60 * 60 * 1000);
    await this.resetTokenRepo.save(this.resetTokenRepo.create({ portalUsuarioId: cuenta.id, tokenHash, expiraEn }));

    const frontendUrl = (this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173').split(',')[0].trim();
    const enlace = `${frontendUrl}/portal/restablecer-password?token=${tokenCrudo}`;
    await this.correoService.enviar({
      to: cuenta.correo,
      subject: 'Restablecer tu contraseña — Portal JAYM LEGAL',
      html: `<p>Hola ${cuenta.nombreCompleto},</p><p>Recibimos una solicitud para restablecer tu contraseña del portal de clientes de JAYM LEGAL.</p><p><a href="${enlace}">${enlace}</a></p><p>Este enlace vale por ${HORAS_VALIDEZ_TOKEN} hora. Si no fuiste tú, ignora este correo.</p>`,
    });
    return { mensaje };
  }

  async restablecer(tokenCrudo: string, nuevaPassword: string): Promise<{ actualizado: true }> {
    const tokenHash = crypto.createHash('sha256').update(tokenCrudo).digest('hex');
    const registro = await this.resetTokenRepo.findOne({ where: { tokenHash } });
    const enlaceInvalido = new BadRequestException('Este enlace no es válido o ya expiró. Solicita uno nuevo.');
    if (!registro || registro.usadoEn || registro.expiraEn < new Date()) throw enlaceInvalido;

    const passwordHash = await bcrypt.hash(nuevaPassword, 12);
    await this.portalUsuarioRepo.update(registro.portalUsuarioId, {
      passwordHash,
      debeCambiarPassword: false,
      intentosFallidosLogin: 0,
      bloqueadoHastaLogin: undefined,
    });
    await this.resetTokenRepo.update({ portalUsuarioId: registro.portalUsuarioId, usadoEn: IsNull() }, { usadoEn: new Date() });
    return { actualizado: true };
  }
}
