import { describe, it, expect, afterEach, vi } from 'vitest';
import { numeroDoAmbiente } from '../../src/utils/env';

const original = { ...process.env };
afterEach(() => {
  process.env = { ...original };
  vi.restoreAllMocks();
});

describe('numeroDoAmbiente', () => {
  it('lê o número quando a variável está preenchida', () => {
    process.env.TESTE_NUM = '5000';
    expect(numeroDoAmbiente('TESTE_NUM', 240_000)).toBe(5000);
  });

  it('usa o padrão quando a variável não existe', () => {
    delete process.env.TESTE_NUM;
    expect(numeroDoAmbiente('TESTE_NUM', 240_000)).toBe(240_000);
  });

  /**
   * O caso que quebrou a produção: o docker-compose repassa
   * `LEITURA_PRAZO_MS: ${LEITURA_PRAZO_MS:-}`, o que define a variável como
   * string VAZIA quando ela não está no .env. Com `?? padrao`, `''` não é
   * nullish e `Number('')` vira 0 — teto de zero, toda leitura estourando o
   * tempo limite, sem nenhum erro no log.
   */
  it('usa o padrão quando a variável vem como string vazia (compose com :-})', () => {
    process.env.TESTE_NUM = '';
    expect(numeroDoAmbiente('TESTE_NUM', 240_000)).toBe(240_000);
  });

  it('usa o padrão quando a variável é só espaço', () => {
    process.env.TESTE_NUM = '   ';
    expect(numeroDoAmbiente('TESTE_NUM', 240_000)).toBe(240_000);
  });

  it('recusa valor não numérico e avisa', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.TESTE_NUM = 'abc';
    expect(numeroDoAmbiente('TESTE_NUM', 240_000)).toBe(240_000);
    expect(warn).toHaveBeenCalled();
  });

  it('recusa zero e negativo — desligariam o recurso em silêncio', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.TESTE_NUM = '0';
    expect(numeroDoAmbiente('TESTE_NUM', 240_000)).toBe(240_000);
    process.env.TESTE_NUM = '-1';
    expect(numeroDoAmbiente('TESTE_NUM', 240_000)).toBe(240_000);
  });
});
