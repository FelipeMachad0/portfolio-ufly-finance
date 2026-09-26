import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest';

beforeAll(() => {
  process.env['JWT_SECRET'] = 'test-secret-key-for-unit-tests';
  process.env['JWT_EXPIRY'] = '1h';
});

// A verificação criptográfica é testada em msal-auth.verificacao.test.ts. Aqui
// ela é mockada para exercitar o que vem DEPOIS: vincular, criar, recusar.
const jwtVerifyMock = vi.fn();
vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn(() => ({})),
  jwtVerify: (...args: unknown[]) => jwtVerifyMock(...args),
}));

vi.mock('../../src/services/audit.service', () => ({
  registrarAuditoria: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../src/models/user.model', () => ({
  findUserByEmail: vi.fn(),
  updateLastLogin: vi.fn().mockResolvedValue(undefined),
}));

// Só a LEITURA do mapeamento é mockada (ela vai ao banco). `resolverPapel` é puro
// e fica o real — é a regra de permissão, não faz sentido simular.
const mapeamentoMock = vi.fn();
vi.mock('../../src/models/entra-group.model', async () => {
  const real = await vi.importActual<typeof import('../../src/models/entra-group.model')>(
    '../../src/models/entra-group.model'
  );
  return { ...real, listarMapeamentoDeGrupos: () => mapeamentoMock() };
});

/** Mapeamento real do tenant, usado nos testes de grupo. */
const GRUPO_GESTOR_GERAL = 'abcdef10-0000-4000-8000-000000000010';
const MAPEAMENTO = [
  {
    groupObjectId: GRUPO_GESTOR_GERAL,
    groupName: 'Financeiro-GestorGeral',
    role: 'GESTOR_GERAL',
    precedence: 10,
  },
];

import { pool } from '../../src/database/pool';
import { findUserByEmail } from '../../src/models/user.model';
import {
  handleEntraCallback,
  UsuarioSemAcessoError,
  ClaimDeGruposIndisponivelError,
} from '../../src/services/msal-auth.service';

const TENANT = '11111111-1111-1111-1111-111111111111';
const CLIENT = '22222222-2222-2222-2222-222222222222';

/** Simula um idToken que passou na verificação, com as claims informadas. */
function tokenValidoCom(payload: Record<string, unknown>) {
  jwtVerifyMock.mockResolvedValueOnce({ payload });
  return 'token-verificado-pelo-mock';
}

describe('msal-auth.service', () => {
  const envOriginal = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env['MSAL_TENANT_ID'] = TENANT;
    process.env['MSAL_CLIENT_ID'] = CLIENT;
    delete process.env['ENTRA_AUTO_PROVISION'];
    // Sem mapeamento por default: os testes abaixo exercitam o caminho antigo,
    // em que o acesso depende do cadastro e do flag.
    mapeamentoMock.mockResolvedValue([]);
  });
  afterEach(() => {
    process.env = { ...envOriginal };
  });

  it('lança erro se o token verificado não traz oid', async () => {
    const t = tokenValidoCom({ email: 'a@b.com' });
    await expect(handleEntraCallback(t)).rejects.toThrow(/oid/);
  });

  it('lança erro se o token verificado não traz email', async () => {
    const t = tokenValidoCom({ oid: 'azure-id-1' });
    await expect(handleEntraCallback(t)).rejects.toThrow(/email/);
  });

  it('recusa usuário sem cadastro quando o provisionamento automático está desligado', async () => {
    // Default seguro: os dados são compartilhados, então login no tenant não
    // pode virar acesso ao financeiro por si só.
    const t = tokenValidoCom({ oid: 'azure-9', email: 'desconhecido@exemplo.com.br', name: 'X' });
    vi.spyOn(pool, 'query').mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    vi.mocked(findUserByEmail).mockResolvedValueOnce(null);

    await expect(handleEntraCallback(t)).rejects.toBeInstanceOf(UsuarioSemAcessoError);
  });

  it('cria o usuário quando o provisionamento automático está ligado', async () => {
    process.env['ENTRA_AUTO_PROVISION'] = 'true';
    const t = tokenValidoCom({ oid: 'azure-1', email: 'novo@exemplo.com.br', name: 'Novo' });

    vi.spyOn(pool, 'query')
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never)
      .mockResolvedValueOnce({
        rows: [
          { id: 'u-1', email: 'novo@exemplo.com.br', name: 'Novo', role: 'USUARIO', status: 'ATIVO', entra_id: 'azure-1', deleted_at: null },
        ],
        rowCount: 1,
      } as never);
    vi.mocked(findUserByEmail).mockResolvedValueOnce(null);

    const result = await handleEntraCallback(t);
    expect(result.user.email).toBe('novo@exemplo.com.br');
    expect(result.token).toBeTruthy();
  });

  it('vincula entra_id a usuário já cadastrado pelo email', async () => {
    const t = tokenValidoCom({ oid: 'azure-2', email: 'existente@exemplo.com.br', name: 'Existente' });

    vi.spyOn(pool, 'query')
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never)
      .mockResolvedValueOnce({
        rows: [
          { id: 'u-2', email: 'existente@exemplo.com.br', name: 'Existente', role: 'GESTOR_GERAL', status: 'ATIVO', entra_id: 'azure-2', deleted_at: null },
        ],
        rowCount: 1,
      } as never);
    vi.mocked(findUserByEmail).mockResolvedValueOnce({
      id: 'u-2', email: 'existente@exemplo.com.br', name: 'Existente', role: 'GESTOR_GERAL', status: 'ATIVO', entra_id: null, deleted_at: null,
    } as never);

    const result = await handleEntraCallback(t);
    expect(result.user.id).toBe('u-2');
    expect(result.user.role).toBe('GESTOR_GERAL');
  });

  it('grupo do Entra concede acesso sem depender de cadastro prévio', async () => {
    // É o ponto do desenho combinado com o admin do tenant: incluir a pessoa no
    // grupo basta, ninguém cadastra usuário na aplicação. Note que
    // ENTRA_AUTO_PROVISION continua desligado aqui.
    mapeamentoMock.mockResolvedValue(MAPEAMENTO);
    const t = tokenValidoCom({
      oid: 'azure-10',
      email: 'gestor@exemplo.com.br',
      name: 'Gestor',
      groups: [GRUPO_GESTOR_GERAL],
    });

    vi.spyOn(pool, 'query')
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never)
      .mockResolvedValueOnce({
        rows: [
          { id: 'u-10', email: 'gestor@exemplo.com.br', name: 'Gestor', role: 'GESTOR_GERAL', status: 'ATIVO', entra_id: 'azure-10', deleted_at: null },
        ],
        rowCount: 1,
      } as never);
    vi.mocked(findUserByEmail).mockResolvedValueOnce(null);

    const result = await handleEntraCallback(t);
    expect(result.user.role).toBe('GESTOR_GERAL');
  });

  it('recusa quem autentica no tenant mas não está em grupo desta aplicação', async () => {
    // O caso que justifica tudo: os lançamentos são compartilhados, então
    // qualquer funcionário logado veria o financeiro inteiro da empresa.
    mapeamentoMock.mockResolvedValue(MAPEAMENTO);
    const t = tokenValidoCom({
      oid: 'azure-11',
      email: 'alguem@exemplo.com.br',
      name: 'Alguem',
      groups: ['99999999-9999-9999-9999-999999999999'],
    });
    vi.spyOn(pool, 'query').mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    vi.mocked(findUserByEmail).mockResolvedValueOnce(null);

    await expect(handleEntraCallback(t)).rejects.toBeInstanceOf(UsuarioSemAcessoError);
  });

  it('ajusta o papel do usuário existente quando o grupo mudou no Entra', async () => {
    // Trocar a pessoa de grupo no Entra tem que refletir no próximo login, senão
    // uma promoção (ou uma revogação) exigiria mexer na aplicação também.
    mapeamentoMock.mockResolvedValue(MAPEAMENTO);
    const t = tokenValidoCom({
      oid: 'azure-12',
      email: 'promovido@exemplo.com.br',
      name: 'Promovido',
      groups: [GRUPO_GESTOR_GERAL],
    });

    vi.spyOn(pool, 'query')
      // findUserByEntraId: já existe, hoje como USUARIO
      .mockResolvedValueOnce({
        rows: [
          { id: 'u-12', email: 'promovido@exemplo.com.br', name: 'Promovido', role: 'USUARIO', status: 'ATIVO', entra_id: 'azure-12', deleted_at: null },
        ],
        rowCount: 1,
      } as never)
      // atualizarPapel
      .mockResolvedValueOnce({
        rows: [
          { id: 'u-12', email: 'promovido@exemplo.com.br', name: 'Promovido', role: 'GESTOR_GERAL', status: 'ATIVO', entra_id: 'azure-12', deleted_at: null },
        ],
        rowCount: 1,
      } as never);

    const result = await handleEntraCallback(t);
    expect(result.user.role).toBe('GESTOR_GERAL');
  });

  it('token com indicador de overage de grupos falha com erro específico', async () => {
    // Pessoa em grupos demais: o Entra move a lista para o Graph e manda
    // _claim_names. Sem tratar, viraria "sem acesso" e o administrador iria
    // procurar defeito no grupo, que está correto.
    mapeamentoMock.mockResolvedValue(MAPEAMENTO);
    const t = tokenValidoCom({
      oid: 'azure-13',
      email: 'muitosgrupos@exemplo.com.br',
      name: 'Muitos Grupos',
      _claim_names: { groups: 'src1' },
    });

    await expect(handleEntraCallback(t)).rejects.toBeInstanceOf(
      ClaimDeGruposIndisponivelError
    );
  });

  it('lança erro se o usuário está inativo', async () => {
    const t = tokenValidoCom({ oid: 'azure-3', email: 'inativo@exemplo.com.br', name: 'X' });
    vi.spyOn(pool, 'query').mockResolvedValueOnce({
      rows: [
        { id: 'u-3', email: 'inativo@exemplo.com.br', name: 'X', role: 'USUARIO', status: 'INATIVO', entra_id: 'azure-3', deleted_at: null },
      ],
      rowCount: 1,
    } as never);

    await expect(handleEntraCallback(t)).rejects.toThrow(/desativado/);
  });
});
