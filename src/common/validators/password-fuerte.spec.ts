import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { PasswordFuerte } from './password-fuerte.js';

class Dto {
  @PasswordFuerte()
  password!: string;
}

async function errores(password: string) {
  const dto = new Dto();
  dto.password = password;
  return (await validate(dto)).length;
}

describe('PasswordFuerte', () => {
  it('acepta 10+ caracteres con letras y numeros', async () => {
    expect(await errores('Defender2026ok')).toBe(0);
  });
  it('rechaza menos de 10 caracteres', async () => {
    expect(await errores('Abc12345')).toBe(1);
  });
  it('rechaza solo letras', async () => {
    expect(await errores('sololetrasmuylargas')).toBe(1);
  });
  it('rechaza solo numeros', async () => {
    expect(await errores('12345678901234')).toBe(1);
  });
});
