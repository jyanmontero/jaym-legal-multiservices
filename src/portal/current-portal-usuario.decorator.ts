import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JwtPayloadPortal } from './portal-auth.service.js';

export const CurrentPortalUsuario = createParamDecorator(
  (data: keyof JwtPayloadPortal | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const usuario: JwtPayloadPortal = request.user;
    return data ? usuario?.[data] : usuario;
  },
);
