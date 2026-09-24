import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JwtPayloadColaborador } from './colaborador-auth.service.js';

export const CurrentColaborador = createParamDecorator(
  (data: keyof JwtPayloadColaborador | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const colaborador: JwtPayloadColaborador = request.user;
    return data ? colaborador?.[data] : colaborador;
  },
);
