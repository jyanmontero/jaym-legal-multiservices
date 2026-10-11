import { ForbiddenException, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { SoloStaffGuard } from './solo-staff.guard.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { SESION_EXTERNA_KEY } from '../decorators/sesion-externa.decorator.js';

function contexto(user: unknown, meta: Record<string, boolean> = {}) {
  const handler = () => undefined;
  const clase = class {};
  const reflector = {
    getAllAndOverride: (clave: string) => meta[clave],
  } as unknown as Reflector;
  const ctx = {
    getHandler: () => handler,
    getClass: () => clase,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
  return { guard: new SoloStaffGuard(reflector), ctx };
}

describe('SoloStaffGuard', () => {
  it('deja pasar al personal interno (token sin tipo)', () => {
    const { guard, ctx } = contexto({ sub: '1', rol: 'ABOGADO_ADMINISTRADOR' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('rechaza un token del portal en una ruta interna', () => {
    const { guard, ctx } = contexto({ sub: '1', tipo: 'portal' });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('rechaza un token de colaborador en una ruta interna', () => {
    const { guard, ctx } = contexto({ sub: '1', tipo: 'colaborador' });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('permite sesiones externas en rutas marcadas @SesionExterna()', () => {
    const { guard, ctx } = contexto({ sub: '1', tipo: 'portal' }, { [SESION_EXTERNA_KEY]: true });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('no interfiere con rutas publicas', () => {
    const { guard, ctx } = contexto(undefined, { [IS_PUBLIC_KEY]: true });
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
