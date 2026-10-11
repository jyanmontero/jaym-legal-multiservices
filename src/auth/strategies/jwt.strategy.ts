import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtPayloadUsuario } from '../decorators/current-user.decorator.js';
import { obtenerJwtSecretObligatorio } from '../../common/config/jwt-secret.js';
import { Usuario } from '../../usuarios/usuario.entity.js';
import { EstadoUsuario } from '../../common/enums/index.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectRepository(Usuario) private readonly usuarioRepo: Repository<Usuario>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: obtenerJwtSecretObligatorio(config),
    });
  }

  async validate(payload: JwtPayloadUsuario & { tipo?: string; tokenVersion?: number }) {
    // Sesiones del portal y de colaboradores: cada una se valida en su propio
    // guard (PortalAuthGuard / ColaboradorAuthGuard); SoloStaffGuard impide
    // que se usen en rutas internas.
    if (payload.tipo !== undefined) return payload;

    // Personal interno: la cuenta debe seguir activa y el token no haber sido
    // revocado (cambio o restablecimiento de contrasena, suspension).
    const usuario = await this.usuarioRepo.findOne({
      where: { id: payload.sub },
      select: { id: true, estado: true, tokenVersion: true, rol: true },
    });
    if (
      !usuario ||
      usuario.estado !== EstadoUsuario.ACTIVO ||
      (payload.tokenVersion ?? 0) !== usuario.tokenVersion
    ) {
      throw new UnauthorizedException('Tu sesión ya no es válida. Inicia sesión de nuevo.');
    }
    // El rol sale de la base de datos: un cambio de rol aplica de inmediato.
    return { ...payload, rol: usuario.rol };
  }
}
