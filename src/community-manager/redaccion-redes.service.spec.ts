import { describe, it, expect } from 'vitest';
import { mensajeErrorIa } from './redaccion-redes.service.js';

const err = (status: number | undefined, message: string) => Object.assign(new Error(message), { status });

describe('mensajeErrorIa', () => {
  it('distingue saldo, clave, saturación y límite', () => {
    expect(mensajeErrorIa(err(400, 'Your credit balance is too low'))).toContain('saldo');
    expect(mensajeErrorIa(err(401, 'invalid x-api-key'))).toContain('clave');
    expect(mensajeErrorIa(err(529, 'Overloaded'))).toContain('saturado');
    expect(mensajeErrorIa(err(429, 'rate limit'))).toContain('demasiadas');
    expect(mensajeErrorIa(err(404, 'model not found'))).toContain('modelo');
  });
  it('tiempo agotado y respuesta vacía', () => {
    expect(mensajeErrorIa(err(undefined, 'Request timed out.'))).toContain('tardó');
    expect(mensajeErrorIa(new Error('respuesta vacía'))).toContain('no devolvió texto');
  });
  it('no filtra el mensaje interno en errores desconocidos', () => {
    expect(mensajeErrorIa(err(418, 'sk-ant-secreto'))).not.toContain('sk-ant');
  });
});
