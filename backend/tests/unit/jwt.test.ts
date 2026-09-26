import { describe, it, expect, beforeAll } from 'vitest';
import { generateToken, verifyToken } from '../../src/utils/jwt';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-key-for-unit-tests';
  process.env.JWT_EXPIRY = '1h';
});

describe('generateToken', () => {
  it('gera token não vazio', () => {
    const token = generateToken({ userId: 'abc', email: 'test@test.com' });
    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');
  });

  it('gera tokens diferentes para payloads diferentes', () => {
    const t1 = generateToken({ userId: 'a', email: 'a@test.com' });
    const t2 = generateToken({ userId: 'b', email: 'b@test.com' });
    expect(t1).not.toBe(t2);
  });
});

describe('verifyToken', () => {
  it('verifica token válido', () => {
    const payload = { userId: 'user-1', email: 'user@test.com' };
    const token = generateToken(payload);
    const decoded = verifyToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.userId).toBe(payload.userId);
    expect(decoded?.email).toBe(payload.email);
  });

  it('retorna null para token inválido', () => {
    const result = verifyToken('token.invalido.aqui');
    expect(result).toBeNull();
  });

  it('retorna null para string vazia', () => {
    const result = verifyToken('');
    expect(result).toBeNull();
  });
});
