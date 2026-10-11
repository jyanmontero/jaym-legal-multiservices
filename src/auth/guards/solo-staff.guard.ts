import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { SESION_EXTERNA_KEY } from '../decorators/sesion-externa.decorator.js';

/**
 * Guard global (se registra despues de JwtAuthGuard). Los tres tipos de sesion
 * (personal interno, clientes del portal y colaboradores) se firman con el
 * mismo JWT_SECRET, asi que JwtAuthGuard por si solo deja pasar un token del
 * portal o de colaborador en CUALQUIER ruta autenticada. Este guard cierra esa
 * puerta: el personal interno no lleva `tipo` en su token; si el token trae
 * `tipo`, solo puede usarse en rutas marcadas con @SesionExterna().
 */
@Injectable()
export class SoloStaffGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const destinos = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, destinos)) return true;
    if (this.reflector.getAllAndOverride<boolean>(SESION_EXTERNA_KEY, destinos)) return true;

    const usuario = context.switchToHttp().getRequest().user;
    if (usuario && usuario.tipo !== undefined) {
      throw new ForbiddenException('Esta sesión no tiene acceso a esta sección.');
    }
    return true;
  }
}
