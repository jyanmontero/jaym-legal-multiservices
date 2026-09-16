import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

/**
 * Exige que el JWT presentado sea uno emitido por el Portal del Cliente
 * (payload.tipo === 'portal'), nunca un token de staff interno. JwtAuthGuard
 * (global) ya validó la firma/expiración antes de llegar aquí -- este guard
 * solo distingue el "tipo" de sesión.
 */
@Injectable()
export class PortalAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const usuario = request.user;
    if (!usuario || usuario.tipo !== 'portal') {
      throw new ForbiddenException('Esta acción requiere una sesión del Portal del Cliente');
    }
    return true;
  }
}
