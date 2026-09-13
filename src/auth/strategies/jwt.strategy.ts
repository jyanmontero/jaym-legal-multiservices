import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayloadUsuario } from '../decorators/current-user.decorator.js';
import { obtenerJwtSecretObligatorio } from '../../common/config/jwt-secret.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: obtenerJwtSecretObligatorio(config),
    });
  }

  async validate(payload: JwtPayloadUsuario) {
    // Lo que se retorna aquí queda disponible como `request.user`.
    return payload;
  }
}
