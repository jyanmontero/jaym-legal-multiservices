import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

/**
 * Exige que el JWT presentado sea uno emitido por el Portal de Colaboradores
 * (payload.tipo === 'colaborador'), nunca un token de staff interno ni del
 * Portal del Cliente. JwtAuthGuard (global) ya validó la firma/expiración
 * antes de llegar aquí -- este guard solo distingue el "tipo" de sesión.
 * Mismo patrón que PortalAuthGuard.
 */
@Injectable()
export class ColaboradorAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const usuario = request.user;
    if (!usuario || usuario.tipo !== 'colaborador') {
      throw new ForbiddenException('Esta acción requiere una sesión del Portal de Colaboradores');
    }
    return true;
  }
}
