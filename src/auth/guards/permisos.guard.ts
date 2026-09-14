import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISOS_KEY } from '../decorators/permisos.decorator.js';
import { Permiso } from '../../common/enums/index.js';
import { tienePermiso } from '../permisos/tiene-permiso.js';

@Injectable()
export class PermisosGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const permisosRequeridos = this.reflector.getAllAndOverride<Permiso[]>(PERMISOS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!permisosRequeridos || permisosRequeridos.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const usuario = request.user;

    const faltante = permisosRequeridos.find((p) => !tienePermiso(usuario, p));
    if (faltante) {
      throw new ForbiddenException(`Esta acción requiere el permiso: ${faltante}`);
    }

    return true;
  }
}
