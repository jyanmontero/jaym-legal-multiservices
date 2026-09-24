import { Injectable, UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Colaborador } from './colaborador.entity.js';
import { ColaboradorPasswordResetToken } from './colaborador-password-reset-token.entity.js';
import { LoginColaboradorDto } from './dto/colaborador-auth.dto.js';
import { CorreoService } from '../notificaciones/correo.service.js';
import { TipoColaborador } from '../common/enums/index.js';

// Mismos umbrales que PortalAuthService -- ver ese archivo para el
// razonamiento (10 intentos, 15 minutos de bloqueo, 1 hora de validez del
// enlace de recuperación).
const HORAS_VALIDEZ_TOKEN = 1;
const MINUTOS_BLOQUEO = 15;
const INTENTOS_MAXIMOS = 10;

export interface JwtPayloadColaborador {
  sub: string; // id del Colaborador
  correo: string;
  tipoColaborador: TipoColaborador; // externo | interno -- nunca confundir con el discriminador de abajo
  tipo: 'colaborador'; // discriminador de sesión, igual criterio que JwtPayloadPortal.tipo === 'portal'
}

@Injectable()
export class ColaboradorAuthService {
  constructor(
    @InjectRepository(Colaborador) private readonly colaboradorRepo: Repository<Colaborador>,
    @InjectRepository(ColaboradorPasswordResetToken) private readonly resetTokenRepo: Repository<ColaboradorPasswordResetToken>,
    private readonly jwtService: JwtService,
    private readonly correoService: CorreoService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginColaboradorDto) {
    const cuenta = await this.colaboradorRepo.findOne({ where: { correo: dto.correo } });
    const credencialesInvalidas = new UnauthorizedException('Credenciales inválidas');

    if (!cuenta) throw credencialesInvalidas;
    if (!cuenta.activo) {
      throw new UnauthorizedException('Este acceso está desactivado. Contacta a JAYM LEGAL.');
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
      await this.colaboradorRepo.update(cuenta.id, {
        intentosFallidosLogin: intentos,
        bloqueadoHastaLogin: intentos >= INTENTOS_MAXIMOS ? new Date(Date.now() + MINUTOS_BLOQUEO * 60000) : cuenta.bloqueadoHastaLogin,
      });
      throw credencialesInvalidas;
    }

    await this.colaboradorRepo.update(cuenta.id, {
      ultimoAcceso: new Date(),
      intentosFallidosLogin: 0,
      bloqueadoHastaLogin: undefined,
    });

    const payload: JwtPayloadColaborador = {
      sub: cuenta.id,
      correo: cuenta.correo,
      tipoColaborador: cuenta.tipo,
      tipo: 'colaborador',
    };
    return {
      accessToken: await this.jwtService.signAsync(payload),
      colaborador: {
        id: cuenta.id,
        nombreCompleto: cuenta.nombreCompleto,
        correo: cuenta.correo,
        tipo: cuenta.tipo,
        debeCambiarPassword: cuenta.debeCambiarPassword,
      },
    };
  }

  async cambiarPassword(colaboradorId: string, actual: string, nueva: string) {
    const cuenta = await this.colaboradorRepo.findOne({ where: { id: colaboradorId } });
    if (!cuenta) throw new ForbiddenException();
    const valido = await bcrypt.compare(actual, cuenta.passwordHash);
    if (!valido) throw new UnauthorizedException('La contraseña actual no es correcta');
    const passwordHash = await bcrypt.hash(nueva, 12);
    await this.colaboradorRepo.update(cuenta.id, { passwordHash, debeCambiarPassword: false });
    return { actualizado: true };
  }

  async solicitarReset(correo: string): Promise<{ mensaje: string }> {
    const mensaje = 'Si el correo está registrado como colaborador, te enviamos un enlace para restablecer tu contraseña.';
    const cuenta = await this.colaboradorRepo.findOne({ where: { correo } });
    if (!cuenta || !cuenta.activo) return { mensaje };

    await this.resetTokenRepo.update({ colaboradorId: cuenta.id, usadoEn: IsNull() }, { usadoEn: new Date() });

    const tokenCrudo = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(tokenCrudo).digest('hex');
    const expiraEn = new Date(Date.now() + HORAS_VALIDEZ_TOKEN * 60 * 60 * 1000);
    await this.resetTokenRepo.save(this.resetTokenRepo.create({ colaboradorId: cuenta.id, tokenHash, expiraEn }));

    const frontendUrl = (this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173').split(',')[0].trim();
    const enlace = `${frontendUrl}/colaboradores/restablecer-password?token=${tokenCrudo}`;
    await this.correoService.enviar({
      to: cuenta.correo,
      subject: 'Restablecer tu contraseña — Portal de Colaboradores JAYM LEGAL',
      html: `<p>Hola ${cuenta.nombreCompleto},</p><p>Recibimos una solicitud para restablecer tu contraseña del Portal de Colaboradores de JAYM LEGAL.</p><p><a href="${enlace}">${enlace}</a></p><p>Este enlace vale por ${HORAS_VALIDEZ_TOKEN} hora. Si no fuiste tú, ignora este correo.</p>`,
    });
    return { mensaje };
  }

  async restablecer(tokenCrudo: string, nuevaPassword: string): Promise<{ actualizado: true }> {
    const tokenHash = crypto.createHash('sha256').update(tokenCrudo).digest('hex');
    const registro = await this.resetTokenRepo.findOne({ where: { tokenHash } });
    const enlaceInvalido = new BadRequestException('Este enlace no es válido o ya expiró. Solicita uno nuevo.');
    if (!registro || registro.usadoEn || registro.expiraEn < new Date()) throw enlaceInvalido;

    const passwordHash = await bcrypt.hash(nuevaPassword, 12);
    await this.colaboradorRepo.update(registro.colaboradorId, {
      passwordHash,
      debeCambiarPassword: false,
      intentosFallidosLogin: 0,
      bloqueadoHastaLogin: undefined,
    });
    await this.resetTokenRepo.update({ colaboradorId: registro.colaboradorId, usadoEn: IsNull() }, { usadoEn: new Date() });
    return { actualizado: true };
  }
}
