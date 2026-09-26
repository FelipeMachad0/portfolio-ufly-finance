import { describe, it, expect } from 'vitest';
import { resolverPapel, type EntraGroupMapping } from '../../src/models/entra-group.model';

/** Mapeamento real criado no tenant da Ufly (migration 20260806000000). */
const MAPEAMENTO: EntraGroupMapping[] = [
  {
    groupObjectId: 'abcdef10-0000-4000-8000-000000000010',
    groupName: 'Financeiro-GestorGeral',
    role: 'GESTOR_GERAL',
    precedence: 10,
  },
  {
    groupObjectId: 'abcdef20-0000-4000-8000-000000000020',
    groupName: 'Financeiro-GestorDepartamento',
    role: 'GESTOR_DEPARTAMENTO',
    precedence: 20,
  },
  {
    groupObjectId: 'abcdef30-0000-4000-8000-000000000030',
    groupName: 'Financeiro-Auditor',
    role: 'AUDITOR',
    precedence: 30,
  },
  {
    groupObjectId: 'abcdef40-0000-4000-8000-000000000040',
    groupName: 'Financeiro-Usuario',
    role: 'USUARIO',
    precedence: 40,
  },
];

describe('resolverPapel', () => {
  it('resolve o papel de um grupo conhecido', () => {
    expect(resolverPapel(['abcdef30-0000-4000-8000-000000000030'], MAPEAMENTO)).toEqual({
      role: 'AUDITOR',
      groupName: 'Financeiro-Auditor',
    });
  });

  it('em mais de um grupo, vale a menor precedência', () => {
    // Quem é gestor geral também está no grupo de usuário. Sem a precedência, o
    // papel dependeria da ordem em que o Entra montou a claim — e o gestor
    // poderia ser rebaixado a usuário comum a cada login.
    const grupos = [
      'abcdef40-0000-4000-8000-000000000040', // Usuario (40)
      'abcdef10-0000-4000-8000-000000000010', // GestorGeral (10)
    ];
    expect(resolverPapel(grupos, MAPEAMENTO)?.role).toBe('GESTOR_GERAL');
    // E o resultado não muda com a ordem invertida.
    expect(resolverPapel([...grupos].reverse(), MAPEAMENTO)?.role).toBe('GESTOR_GERAL');
  });

  it('ignora grupos do tenant que não são desta aplicação', () => {
    // Uma pessoa pertence a muitos grupos da empresa; só os nossos contam.
    const grupos = [
      '00000000-1111-2222-3333-444444444444',
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    ];
    expect(resolverPapel(grupos, MAPEAMENTO)).toBeUndefined();
  });

  it('sem grupo nenhum devolve undefined, não papel padrão', () => {
    // Este é o ponto de segurança: os dados são compartilhados, então autenticar
    // no tenant não pode dar acesso. Devolver 'USUARIO' aqui entregaria o
    // financeiro inteiro a qualquer funcionário da empresa.
    expect(resolverPapel([], MAPEAMENTO)).toBeUndefined();
  });

  it('compara Object ID sem diferenciar maiúsculas', () => {
    // O Entra pode emitir o GUID em caixa alta; o mapeamento é gravado em minúsculas.
    expect(
      resolverPapel(['ABCDEF10-0000-4000-8000-000000000010'], MAPEAMENTO)?.role
    ).toBe('GESTOR_GERAL');
  });

  it('mapeamento vazio não autoriza ninguém', () => {
    // Se a migration não rodou, ninguém entra — melhor que todos entrarem.
    expect(resolverPapel(['abcdef10-0000-4000-8000-000000000010'], [])).toBeUndefined();
  });
});
