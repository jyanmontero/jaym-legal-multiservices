import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface JwtPayloadUsuario {
  sub: string; // id del usuario
  correo: string;
  rol: string;
}

/**
 * Extrae el usuario autenticado del request (colocado ahí por JwtStrategy).
 * Reemplaza el header temporal `x-usuario-id` usado en Clientes/Expedientes.
 */
export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayloadUsuario | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const usuario: JwtPayloadUsuario = request.user;
    return data ? usuario?.[data] : usuario;
  },
);
