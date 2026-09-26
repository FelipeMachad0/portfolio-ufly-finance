import { createRemoteJWKSet, jwtVerify } from 'jose';
import { findUserByEmail, updateLastLogin } from '../models/user.model';
import { generateToken } from '../utils/jwt';
import { registrarAuditoria } from './audit.service';
import { pool } from '../database/pool';
import { listarMapeamentoDeGrupos, resolverPapel } from '../models/entra-group.model';

export interface EntraIdTokenClaims {
  oid: string;
  email: string;
  name: string;
  preferred_username?: string;
  /** Object IDs dos grupos de segurança do Entra vindos na claim `groups`. */
  groups: string[];
}

export interface EntraAuthResult {
  token: string;
  user: { id: string; email: string; name: string; role: string };
}

interface EntraUserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  entra_id: string | null;
  deleted_at: Date | null;
}

/** Erro de configuração ausente — o controller devolve 503, não 401. */
export class EntraNaoConfiguradoError extends Error {}

/** Usuário autenticado no Entra, mas sem cadastro nesta aplicação. */
export class UsuarioSemAcessoError extends Error {}

/**
 * O Entra não manda a claim `groups` quando a pessoa pertence a muitos grupos
 * (limite de ~200 em id_token): manda `_claim_names`/`_claim_sources` apontando
 * para o Graph. Sem tratar, esse usuário cairia em "sem grupo" e receberia
 * "acesso negado" — mensagem que mandaria o administrador procurar no lugar
 * errado, porque a pessoa ESTÁ no grupo certo.
 */
export class ClaimDeGruposIndisponivelError extends Error {}

/**
 * Cache do JWKS do tenant. O `jose` cuida do cache e da rotação de chaves
 * internamente; criar um por chamada faria uma requisição de rede a cada login.
 */
let jwksCache: ReturnType<typeof createRemoteJWKSet> | null = null;
let jwksTenant = '';

function jwksDoTenant(tenantId: string) {
  if (!jwksCache || jwksTenant !== tenantId) {
    jwksCache = createRemoteJWKSet(
      new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`)
    );
    jwksTenant = tenantId;
  }
  return jwksCache;
}

/**
 * Verifica o idToken do Entra CRIPTOGRAFICAMENTE e devolve o JWT interno.
 *
 * Antes usava `jwt.decode`, que apenas decodifica base64 — sem checar
 * assinatura, emissor, audiência ou expiração. Como esta rota é pública, um
 * idToken forjado com oid/email arbitrários era aceito e o usuário provisionado:
 * bypass completo da autenticação. A validação feita pelo MSAL no navegador não
 * protege um endpoint HTTP.
 */
export async function handleEntraCallback(idToken: string): Promise<EntraAuthResult> {
  const tenantId = process.env['MSAL_TENANT_ID'] ?? '';
  const clientId = process.env['MSAL_CLIENT_ID'] ?? '';

  // Sem tenant/client não há como verificar assinatura nem audiência. Recusar é
  // obrigatório: aceitar aqui equivaleria a confiar em qualquer token.
  if (!tenantId || !clientId) {
    throw new EntraNaoConfiguradoError(
      'Login Microsoft não configurado neste ambiente (MSAL_TENANT_ID / MSAL_CLIENT_ID ausentes).'
    );
  }

  let payload: Record<string, unknown>;
  try {
    const verificado = await jwtVerify(idToken, jwksDoTenant(tenantId), {
      issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
      audience: clientId,
    });
    payload = verificado.payload as Record<string, unknown>;
  } catch (err) {
    throw new Error(`Token do Entra ID inválido: ${(err as Error).message}`);
  }

  if (!payload['oid']) {
    throw new Error('Token do Entra ID sem a claim oid');
  }

  // Grupos que o Entra pôde entregar dentro do token.
  const grupos = Array.isArray(payload['groups'])
    ? (payload['groups'] as unknown[]).map(String)
    : [];

  // Sem `groups` e com indicador de overage: o token existe, mas a lista de
  // grupos ficou grande demais e o Entra a moveu para o Graph. Recusar com
  // mensagem específica é melhor que dizer "sem acesso".
  if (grupos.length === 0 && payload['_claim_names']) {
    throw new ClaimDeGruposIndisponivelError(
      'O Entra não enviou a lista de grupos neste token (usuário pertence a grupos demais). ' +
        'É preciso consultar os grupos pelo Microsoft Graph — peça ajuda ao administrador do tenant.'
    );
  }

  const claims: EntraIdTokenClaims = {
    oid: String(payload['oid']),
    email: String(
      payload['email'] ?? payload['preferred_username'] ?? payload['upn'] ?? ''
    ),
    name: String(payload['name'] ?? payload['given_name'] ?? ''),
    preferred_username: payload['preferred_username'] as string | undefined,
    groups: grupos,
  };

  if (!claims.email) {
    throw new Error('Token do Entra ID sem email');
  }

  // Papel vindo do grupo de segurança. `undefined` = nenhum grupo desta
  // aplicação no token.
  const papel = resolverPapel(claims.groups, await listarMapeamentoDeGrupos());

  // 1. Tentar localizar pelo entra_id
  let user = await findUserByEntraId(claims.oid);

  // 2. Se não, tentar pelo email (vincular conta existente)
  if (!user) {
    const byEmail = await findUserByEmail(claims.email);
    if (byEmail && byEmail.deleted_at === null) {
      user = await linkEntraIdToUser(byEmail.id, claims.oid);
    }
  }

  // 3. Criar novo — quando o grupo do Entra autoriza.
  //
  // O grupo É a lista de acesso: quem está em um dos grupos mapeados entra e é
  // provisionado, sem ninguém cadastrar usuário aqui. Quem não está em nenhum não
  // entra, mesmo autenticando no tenant — os dados desta aplicação são
  // compartilhados, então todo mundo que entra vê o financeiro inteiro.
  //
  // ENTRA_AUTO_PROVISION continua valendo como escape para ambiente sem os grupos
  // configurados (o de desenvolvimento, por exemplo).
  if (!user) {
    const autorizado = papel !== undefined || process.env['ENTRA_AUTO_PROVISION'] === 'true';
    if (!autorizado) {
      throw new UsuarioSemAcessoError(
        `Sem acesso a esta aplicação. Peça ao administrador para incluir ${claims.email} ` +
          `em um dos grupos de acesso do Controle Financeiro no Microsoft Entra.`
      );
    }
    user = await createUserFromEntra(claims, papel?.role);
    await registrarAuditoria(user.id, 'USUARIO_CRIADO', 'users', user.id, null, user);
  }

  if (user.status !== 'ATIVO') {
    throw new Error('Usuário desativado. Contate o administrador.');
  }

  // O grupo é a fonte da verdade do papel: se a pessoa foi movida de grupo no
  // Entra, o papel acompanha no próximo login. Registrado em auditoria porque é
  // mudança de permissão feita sem ninguém mexer na aplicação.
  if (papel && papel.role !== user.role) {
    const antes = { ...user };
    user = await atualizarPapel(user.id, papel.role);
    await registrarAuditoria(user.id, 'USUARIO_EDITADO', 'users', user.id, antes, {
      ...user,
      motivo: `papel ajustado pelo grupo ${papel.groupName} do Entra ID`,
    });
  }

  await updateLastLogin(user.id);

  const token = generateToken({ userId: user.id, email: user.email });

  return {
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  };
}

async function findUserByEntraId(entraId: string): Promise<EntraUserRow | null> {
  const r = await pool.query<EntraUserRow>(
    'SELECT id, email, name, role, status, entra_id, deleted_at FROM users WHERE entra_id = $1::text AND deleted_at IS NULL',
    [entraId]
  );
  return r.rows[0] ?? null;
}

async function linkEntraIdToUser(
  userId: string,
  entraId: string
): Promise<EntraUserRow> {
  const r = await pool.query<EntraUserRow>(
    'UPDATE users SET entra_id = $1::text, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, email, name, role, status, entra_id, deleted_at',
    [entraId, userId]
  );
  return r.rows[0];
}

async function createUserFromEntra(
  claims: EntraIdTokenClaims,
  role = 'USUARIO'
): Promise<EntraUserRow> {
  const r = await pool.query<EntraUserRow>(
    `INSERT INTO users (email, name, entra_id, role, status)
     VALUES ($1, $2, $3::text, $4, 'ATIVO')
     RETURNING id, email, name, role, status, entra_id, deleted_at`,
    [claims.email, claims.name || claims.email, claims.oid, role]
  );
  return r.rows[0];
}

async function atualizarPapel(userId: string, role: string): Promise<EntraUserRow> {
  const r = await pool.query<EntraUserRow>(
    `UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2
     RETURNING id, email, name, role, status, entra_id, deleted_at`,
    [role, userId]
  );
  return r.rows[0];
}
