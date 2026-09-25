import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Colaborador } from './colaborador.entity.js';
import { PERMITIR_PASSWORD_PENDIENTE_KEY } from './permitir-password-pendiente.decorator.js';

/**
 * Exige que el JWT presentado sea uno emitido por el Portal de Colaboradores
 * (payload.tipo === 'colaborador'), nunca un token de staff interno ni del
 * Portal del Cliente. JwtAuthGuard (global) ya validó la firma/expiración
 * antes de llegar aquí. Mismo patrón que PortalAuthGuard, con dos capas
 * añadidas el 26/09/2026 tras la auditoría del Portal de Colaboradores:
 *
 *  1. Revocación real: verifica contra la base de datos que la cuenta sigue
 *     activa y que el tokenVersion del JWT coincide con el actual. Cambiar
 *     la contraseña (propia o por reseteo) o desactivar la cuenta incrementa
 *     tokenVersion, así que cualquier JWT anterior deja de servir de
 *     inmediato en vez de seguir siendo válido hasta su vencimiento natural
 *     (14 días).
 *  2. Contraseña temporal pendiente: si la cuenta tiene debeCambiarPassword,
 *     bloquea cualquier acción salvo la marcada con
 *     @PermitirPasswordPendiente() (el propio endpoint para cambiarla).
 *     Antes, este flag se devolvía en el login pero nada lo hacía cumplir.
 */
@Injectable()
export class ColaboradorAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(Colaborador) private readonly colaboradorRepo: Repository<Colaborador>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const usuario = request.user;
    if (!usuario || usuario.tipo !== 'colaborador') {
      throw new ForbiddenException('Esta acción requiere una sesión del Portal de Colaboradores');
    }

    const cuenta = await this.colaboradorRepo.findOne({ where: { id: usuario.sub } });
    if (!cuenta || !cuenta.activo || cuenta.tokenVersion !== usuario.tokenVersion) {
      throw new ForbiddenException('Esta sesión ya no es válida. Inicia sesión de nuevo.');
    }

    const permitirConCambioPendiente = this.reflector.getAllAndOverride<boolean>(PERMITIR_PASSWORD_PENDIENTE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (cuenta.debeCambiarPassword && !permitirConCambioPendiente) {
      throw new ForbiddenException('Debes establecer una nueva contraseña antes de continuar.');
    }

    // Deja disponible el registro fresco de la cuenta por si un controlador
    // lo necesita sin volver a consultarlo.
    request.colaboradorCuenta = cuenta;
    return true;
  }
}
