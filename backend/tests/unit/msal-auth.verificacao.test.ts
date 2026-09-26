import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Sem mock de `jose` neste arquivo: aqui o objetivo é exercitar a verificação
// criptográfica de verdade. A lógica seguinte (vincular/criar usuário) é testada
// em msal-auth.service.test.ts, com a verificação mockada.
vi.mock('../../src/services/audit.service', () => ({
  registrarAuditoria: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../src/models/user.model', () => ({
  findUserByEmail: vi.fn().mockResolvedValue(null),
  updateLastLogin: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../src/database/pool', () => ({
  pool: { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) },
}));

import {
  handleEntraCallback,
  EntraNaoConfiguradoError,
} from '../../src/services/msal-auth.service';

const TENANT = '11111111-1111-1111-1111-111111111111';
const CLIENT = '22222222-2222-2222-2222-222222222222';

/** idToken forjado: header e payload válidos, assinatura inventada. */
function tokenForjado(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64(payload)}.assinatura-inventada`;
}

describe('verificação do idToken do Entra', () => {
  const envOriginal = { ...process.env };

  beforeEach(() => {
    delete process.env['MSAL_TENANT_ID'];
    delete process.env['MSAL_CLIENT_ID'];
  });
  afterEach(() => {
    process.env = { ...envOriginal };
  });

  it('recusa quando o Entra não está configurado, em vez de confiar no token', async () => {
    await expect(
      handleEntraCallback(tokenForjado({ oid: 'x', email: 'a@b.com' }))
    ).rejects.toBeInstanceOf(EntraNaoConfiguradoError);
  });

  it('REJEITA idToken forjado', async () => {
    // O teste central desta correção. Antes o serviço usava jwt.decode, que só
    // decodifica base64: um token assinado com qualquer chave (ou nenhuma) era
    // aceito e o usuário provisionado — bypass completo da autenticação numa
    // rota pública.
    process.env['MSAL_TENANT_ID'] = TENANT;
    process.env['MSAL_CLIENT_ID'] = CLIENT;

    await expect(
      handleEntraCallback(
        tokenForjado({
          oid: 'invasor-oid',
          email: 'invasor@exemplo.com',
          name: 'Invasor',
          iss: `https://login.microsoftonline.com/${TENANT}/v2.0`,
          aud: CLIENT,
          exp: Math.floor(Date.now() / 1000) + 3600,
        })
      )
    ).rejects.toThrow(/inválido/i);
  });

  it('rejeita texto que não é JWT', async () => {
    process.env['MSAL_TENANT_ID'] = TENANT;
    process.env['MSAL_CLIENT_ID'] = CLIENT;
    await expect(handleEntraCallback('nao-e-um-jwt')).rejects.toThrow(/inválido/i);
  });
});
