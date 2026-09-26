import { describe, it, expect } from 'vitest';
import { iniciaisDoUsuario } from '../utils/iniciais';

describe('iniciaisDoUsuario', () => {
  it('usa primeira letra do primeiro e do último nome', () => {
    // Antes saía "MA" — os dois primeiros caracteres do e-mail.
    expect(iniciaisDoUsuario('Maria Souza', 'maria.souza@exemplo.com.br')).toBe('MS');
  });

  it('ignora nomes do meio', () => {
    expect(iniciaisDoUsuario('Ana Clara Souza Lima')).toBe('AL');
  });

  it('ignora partículas ao escolher o sobrenome', () => {
    // "Maria de Souza": o sobrenome é Souza, não "de".
    expect(iniciaisDoUsuario('Maria de Souza')).toBe('MS');
    expect(iniciaisDoUsuario('João dos Santos')).toBe('JS');
  });

  it('com um nome só, usa as duas primeiras letras dele', () => {
    expect(iniciaisDoUsuario('Roberto')).toBe('RO');
  });

  it('sem nome, deduz do e-mail', () => {
    expect(iniciaisDoUsuario(null, 'maria.souza@exemplo.com.br')).toBe('MS');
    expect(iniciaisDoUsuario('', 'ana_lima@exemplo.com.br')).toBe('AL');
  });

  it('sem nome e sem e-mail utilizável, não quebra', () => {
    expect(iniciaisDoUsuario(null, null)).toBe('??');
    expect(iniciaisDoUsuario('   ', '')).toBe('??');
  });
});
