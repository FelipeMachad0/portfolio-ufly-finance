import { AxiosError, AxiosHeaders, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import dadosIniciais from './dados.json';

/**
 * API da versão estática (GitHub Pages): responde as chamadas do frontend no
 * próprio navegador, a partir de `dados.json`, sem backend nem banco.
 *
 * - Listas saem do JSON; relatórios (resumo, fluxo de caixa, DRE, centros de
 *   custo...) são calculados aqui com as mesmas regras do backend, então
 *   qualquer período do seletor funciona.
 * - Criar, editar e excluir valem na memória, até recarregar a página.
 * - As datas são deslocadas para o último mês dos dados cair no mês atual: a
 *   demo nunca abre com "este mês" vazio, não importa quando for acessada.
 * - O que depende de servidor (upload, importação, exportação XLSX) responde
 *   com um aviso.
 *
 * `dados.json` é gerado pela demo completa: `npm run demo` e depois
 * `npm run demo:exportar` no backend.
 */

type Linha = Record<string, unknown>;

interface Dados {
  usuario: { id: string; email: string; name: string; role: string };
  accounts: Linha[];
  categories: Linha[];
  transactions: Linha[];
  clientes: Linha[];
  projetos: Linha[];
  budgets: Linha[];
  costCenters: Linha[];
  typeFields: Record<string, unknown>;
  users: Linha[];
}

// ─── Estado em memória ──────────────────────────────────────────────────────

function deslocarMeses(iso: string, meses: number): string {
  const d = new Date(iso);
  const dia = d.getUTCDate();
  const alvo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + meses, 1));
  const ultimoDia = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(dia, ultimoDia));
  return alvo.toISOString();
}

function carregar(): Dados {
  const dados = structuredClone(dadosIniciais) as unknown as Dados;
  const datas = dados.transactions.map((t) => new Date(String(t.date)));
  if (datas.length === 0) return dados;

  const ultima = new Date(Math.max(...datas.map((d) => d.getTime())));
  const hoje = new Date();
  const meses =
    (hoje.getUTCFullYear() - ultima.getUTCFullYear()) * 12 + (hoje.getUTCMonth() - ultima.getUTCMonth());
  if (meses !== 0) {
    for (const t of dados.transactions) t.date = deslocarMeses(String(t.date), meses);
  }
  // No mês atual, nada no futuro: o que passaria de hoje vai para hoje.
  const agora = hoje.toISOString();
  for (const t of dados.transactions) {
    if (String(t.date) > agora) t.date = `${agora.slice(0, 10)}T00:00:00.000Z`;
  }
  return dados;
}

const db = carregar();

// ─── Utilidades ─────────────────────────────────────────────────────────────

const num = (v: unknown): number => Number(v ?? 0);
const agoraISO = (): string => new Date().toISOString();
const novoId = (): string => crypto.randomUUID();
const snake = (k: string): string => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const paraSnake = (o: Linha): Linha =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [snake(k), v]));

const ativas = (): Linha[] =>
  db.transactions.filter((t) => t.status === 'completed' && !t.deleted_at);

/** Mesmo critério do backend: o período só filtra com início E fim. */
function noPeriodo(linhas: Linha[], p: Linha): Linha[] {
  if (!p.startDate || !p.endDate) return linhas;
  const ini = new Date(String(p.startDate)).getTime();
  const fim = new Date(String(p.endDate)).getTime();
  return linhas.filter((t) => {
    const d = new Date(String(t.date)).getTime();
    return d >= ini && d <= fim;
  });
}

const categoria = (id: unknown): Linha | undefined => db.categories.find((c) => c.id === id);

function somaPor<T extends string>(linhas: Linha[], chave: (t: Linha) => T): Map<T, number> {
  const m = new Map<T, number>();
  for (const t of linhas) m.set(chave(t), (m.get(chave(t)) ?? 0) + num(t.amount));
  return m;
}

// ─── Relatórios (espelham backend/src/services/report.service.ts) ───────────

function resumo(p: Linha) {
  const linhas = noPeriodo(ativas(), p);
  const receita = linhas.filter((t) => t.type === 'income').reduce((s, t) => s + num(t.amount), 0);
  const despesa = linhas.filter((t) => t.type === 'expense').reduce((s, t) => s + num(t.amount), 0);
  return { totalRevenue: receita, totalExpense: despesa, balance: receita - despesa, transactionCount: linhas.length };
}

function despesasPorCategoria(p: Linha) {
  const linhas = noPeriodo(ativas(), p).filter((t) => t.type === 'expense' && categoria(t.category_id));
  return [...somaPor(linhas, (t) => String(t.category_id))]
    .map(([id, total]) => {
      const c = categoria(id)!;
      return { id, name: c.name, color: c.color ?? '#6B7280', total };
    })
    .sort((a, b) => b.total - a.total);
}

function receitaPorCliente(p: Linha) {
  const linhas = noPeriodo(ativas(), p).filter((t) => t.type === 'income');
  const nome = (t: Linha) =>
    String((t.metadata as Linha | undefined)?.cliente ?? '').trim() || 'Sem cliente';
  return [...somaPor(linhas, nome)]
    .map(([cliente, total]) => ({ cliente, total }))
    .sort((a, b) => b.total - a.total);
}

function receitaVsDespesa(p: Linha) {
  const porDia = p.granularity === 'day';
  const balde = (t: Linha) => String(t.date).slice(0, porDia ? 10 : 7);
  const grupos = new Map<string, { revenue: number; expense: number }>();
  for (const t of noPeriodo(ativas(), p)) {
    const g = grupos.get(balde(t)) ?? { revenue: 0, expense: 0 };
    if (t.type === 'income') g.revenue += num(t.amount);
    if (t.type === 'expense') g.expense += num(t.amount);
    grupos.set(balde(t), g);
  }
  return [...grupos.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([chave, g]) => {
      const d = new Date(porDia ? `${chave}T00:00:00Z` : `${chave}-01T00:00:00Z`);
      const month = porDia
        ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' })
        : d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' });
      return { month, ...g };
    });
}

const SECOES = [
  'receita_servicos', 'receita_produtos', 'deducoes', 'cpv_terceiros', 'cpv_licencas', 'cpv_infra',
  'desp_consultoria', 'desp_marketing', 'desp_outros', 'distribuicao_socios', 'emprestimos', 'outros',
] as const;
type Secao = (typeof SECOES)[number];

function secaoDre(nomeCategoria: unknown, tipo: unknown): Secao {
  const n = String(nomeCategoria ?? '').toLowerCase();
  const tem = (...p: string[]) => p.some((x) => n.includes(x));
  if (tipo === 'income') return tem('produto', 'licença', 'licenca') ? 'receita_produtos' : 'receita_servicos';
  if (tipo !== 'expense') return 'outros';
  if (tem('iss', 'pis', 'cofins', 'irrf', 'imposto')) return 'deducoes';
  if (tem('terceiro', 'parceiro')) return 'cpv_terceiros';
  if (tem('licença', 'licenca')) return 'cpv_licencas';
  if (tem('infra', 'nuvem', 'cloud')) return 'cpv_infra';
  if (tem('consultoria')) return 'desp_consultoria';
  if (tem('marketing', 'publicidade')) return 'desp_marketing';
  if (tem('sócio', 'socio', 'distribuição', 'distribuicao')) return 'distribuicao_socios';
  if (tem('empréstimo', 'emprestimo')) return 'emprestimos';
  return 'desp_outros';
}

const secoesVazias = () => Object.fromEntries(SECOES.map((s) => [s, 0])) as Record<Secao, number>;

function dre(p: Linha) {
  const meses = new Map<string, { month: string; monthLabel: string; sections: Record<Secao, number> }>();
  const totals = secoesVazias();
  for (const t of noPeriodo(ativas(), p)) {
    if (t.type !== 'income' && t.type !== 'expense') continue;
    const mes = String(t.date).slice(0, 7);
    if (!meses.has(mes)) {
      const monthLabel = new Date(`${mes}-01T12:00:00Z`).toLocaleDateString('pt-BR', {
        month: 'short',
        year: '2-digit',
      });
      meses.set(mes, { month: mes, monthLabel, sections: secoesVazias() });
    }
    const secao = secaoDre(categoria(t.category_id)?.name, t.type);
    meses.get(mes)!.sections[secao] += num(t.amount);
    totals[secao] += num(t.amount);
  }
  return {
    months: [...meses.values()].sort((a, b) => a.month.localeCompare(b.month)),
    totals,
    computedAt: agoraISO(),
  };
}

/** Meses proporcionais aos dias cobertos (mesma conta do backend). */
function mesesNoIntervalo(inicio: Date, fim: Date): number {
  const ajustado = new Date(fim.getTime() - 1);
  if (ajustado < inicio) return 0;
  let total = 0;
  let cursor = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
  while (cursor <= ajustado) {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    const fimDoMes = new Date(y, m + 1, 0, 23, 59, 59, 999);
    const fimSegmento = ajustado < fimDoMes ? ajustado : fimDoMes;
    total += (fimSegmento.getDate() - cursor.getDate() + 1) / new Date(y, m + 1, 0).getDate();
    cursor = new Date(y, m + 1, 1);
  }
  return total;
}

function comparativoCentrosCusto(p: Linha) {
  const despesas = ativas().filter((t) => t.type === 'expense');
  const centro = (t: Linha) => String((t.metadata as Linha | undefined)?.centro_custo ?? '').trim();
  const comCentro = despesas.filter((t) => centro(t) !== '');

  let meses: number;
  if (p.startDate && p.endDate) {
    meses = mesesNoIntervalo(new Date(String(p.startDate)), new Date(String(p.endDate)));
  } else if (despesas.length) {
    const ts = despesas.map((t) => new Date(String(t.date)).getTime());
    meses = mesesNoIntervalo(new Date(Math.min(...ts)), new Date(Math.max(...ts) + 1));
  } else {
    meses = 0;
  }

  const realizado = somaPor(noPeriodo(comCentro, p), centro);
  const acumulado = somaPor(comCentro, centro);
  const orcamentos = db.costCenters.filter((b) => !b.deleted_at);
  const nomes = new Set<string>([...orcamentos.map((b) => String(b.cost_center)), ...acumulado.keys()]);

  return [...nomes].sort().map((cc) => {
    const b = orcamentos.find((o) => o.cost_center === cc);
    const previsto = Number((num(b?.monthly_amount) * meses).toFixed(2));
    const real = realizado.get(cc) ?? 0;
    return {
      cost_center: cc,
      label: b?.label ?? null,
      previsto,
      realizado: real,
      acumulado: acumulado.get(cc) ?? 0,
      diferenca: previsto - real,
      uso_pct: previsto > 0 ? (real / previsto) * 100 : null,
    };
  });
}

// ─── Lançamentos ────────────────────────────────────────────────────────────

function listarLancamentos(p: Linha) {
  let linhas = db.transactions.filter((t) => !t.deleted_at);
  for (const [filtro, coluna] of [['accountId', 'account_id'], ['categoryId', 'category_id'], ['type', 'type'], ['status', 'status']]) {
    if (p[filtro]) linhas = linhas.filter((t) => t[coluna] === p[filtro]);
  }
  if (p.startDate) linhas = linhas.filter((t) => new Date(String(t.date)) >= new Date(String(p.startDate)));
  if (p.endDate) linhas = linhas.filter((t) => new Date(String(t.date)) <= new Date(String(p.endDate)));
  const busca = String(p.search ?? '').trim().toLowerCase();
  if (busca) linhas = linhas.filter((t) => String(t.description).toLowerCase().includes(busca));

  linhas.sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.created_at).localeCompare(String(a.created_at)));
  const page = Math.max(1, num(p.page) || 1);
  const limit = Math.max(1, num(p.limit) || 20);
  return {
    data: linhas.slice((page - 1) * limit, page * limit),
    total: linhas.length,
    page,
    limit,
    totalPages: Math.ceil(linhas.length / limit),
  };
}

/** Efeito do lançamento no saldo da conta, como no backend. */
function ajustarSaldo(t: Linha, sinal: 1 | -1): void {
  if (t.status !== 'completed' || t.type === 'transfer') return;
  const conta = db.accounts.find((a) => a.id === t.account_id);
  if (!conta) return;
  const delta = (t.type === 'income' ? 1 : -1) * num(t.amount) * sinal;
  conta.balance = (num(conta.balance) + delta).toFixed(2);
}

function criarLancamento(corpo: Linha): Linha {
  const t: Linha = {
    id: novoId(),
    user_id: db.usuario.id,
    status: 'completed',
    metadata: {},
    ...paraSnake(corpo),
    amount: num(corpo.amount).toFixed(2),
    date: new Date(String(corpo.date)).toISOString(),
    created_at: agoraISO(),
    updated_at: agoraISO(),
    deleted_at: null,
  };
  db.transactions.push(t);
  ajustarSaldo(t, 1);
  return t;
}

function editarLancamento(t: Linha, corpo: Linha): Linha {
  ajustarSaldo(t, -1);
  Object.assign(t, paraSnake(corpo), { updated_at: agoraISO() });
  if (corpo.amount !== undefined) t.amount = num(corpo.amount).toFixed(2);
  if (corpo.date !== undefined) t.date = new Date(String(corpo.date)).toISOString();
  ajustarSaldo(t, 1);
  return t;
}

// ─── CRUD genérico das demais coleções ──────────────────────────────────────

type Colecao = 'accounts' | 'categories' | 'clientes' | 'projetos' | 'costCenters';

/** Clientes vêm do backend em camelCase; as outras coleções em snake_case. */
const EM_CAMEL = new Set<Colecao>(['clientes']);

function criar(colecao: Colecao, corpo: Linha): Linha {
  const camel = EM_CAMEL.has(colecao);
  const linha: Linha = {
    id: novoId(),
    [camel ? 'userId' : 'user_id']: db.usuario.id,
    ...(camel ? corpo : paraSnake(corpo)),
    [camel ? 'createdAt' : 'created_at']: agoraISO(),
    [camel ? 'updatedAt' : 'updated_at']: agoraISO(),
  };
  db[colecao].push(linha);
  return linha;
}

function editar(colecao: Colecao, linha: Linha, corpo: Linha): Linha {
  const camel = EM_CAMEL.has(colecao);
  return Object.assign(linha, camel ? corpo : paraSnake(corpo), {
    [camel ? 'updatedAt' : 'updated_at']: agoraISO(),
  });
}

const visiveis = (colecao: Colecao): Linha[] =>
  db[colecao].filter((l) => !l.deleted_at && !l.deletedAt);

// ─── Roteamento ─────────────────────────────────────────────────────────────

class ErroDaApi extends Error {
  constructor(readonly status: number, mensagem: string) {
    super(mensagem);
  }
}

const INDISPONIVEL = 'Indisponível na demonstração online — rode a versão completa (npm run demo) para usar.';

function corpoDe(config: InternalAxiosRequestConfig): Linha {
  if (config.data instanceof FormData) throw new ErroDaApi(400, INDISPONIVEL);
  if (typeof config.data === 'string' && config.data) return JSON.parse(config.data) as Linha;
  return (config.data as Linha) ?? {};
}

function responder(metodo: string, caminho: string, p: Linha, config: InternalAxiosRequestConfig): unknown {
  const partes = caminho.split('/').filter(Boolean);
  const [recurso, id, acao] = partes;

  if (recurso === 'auth') {
    if (id === 'demo') return { token: 'demo-estatica', user: db.usuario };
    if (id === 'logout') return {};
    throw new ErroDaApi(400, 'Nesta demonstração o acesso é pelo botão "Entrar como demonstração".');
  }

  if (recurso === 'reports' && metodo === 'get') {
    const relatorios: Record<string, (p: Linha) => unknown> = {
      summary: resumo,
      'expenses-by-category': despesasPorCategoria,
      'revenue-by-client': receitaPorCliente,
      'revenue-vs-expense': receitaVsDespesa,
      dre,
    };
    if (relatorios[id]) return relatorios[id](p);
  }

  if (recurso === 'users') {
    if (metodo === 'get') return id === 'me' ? db.usuario : db.users;
    throw new ErroDaApi(400, 'Gestão de usuários indisponível na demonstração online.');
  }

  if (recurso === 'type-fields') {
    if (metodo === 'get') return db.typeFields;
    if (metodo === 'put') {
      db.typeFields[id] = corpoDe(config).fieldsSchema;
      return db.typeFields;
    }
  }

  if (recurso === 'importacoes' && metodo === 'get') return { importacoes: [] };
  if (recurso === 'budgets' && metodo === 'get') return db.budgets;

  if (recurso === 'transactions') {
    if (metodo === 'get' && !id) return listarLancamentos(p);
    const t = db.transactions.find((x) => x.id === id && !x.deleted_at);
    if (metodo === 'post' && !id) return criarLancamento(corpoDe(config));
    if (!t) throw new ErroDaApi(404, 'Lançamento não encontrado');
    if (metodo === 'get') return t;
    if (metodo === 'put') return editarLancamento(t, corpoDe(config));
    if (metodo === 'delete') {
      ajustarSaldo(t, -1);
      t.deleted_at = agoraISO();
      return {};
    }
  }

  if (recurso === 'cost-centers' && id === 'comparison') return comparativoCentrosCusto(p);

  const colecoes: Record<string, Colecao> = {
    accounts: 'accounts',
    categories: 'categories',
    clientes: 'clientes',
    projetos: 'projetos',
    'cost-centers': 'costCenters',
  };
  const colecao = colecoes[recurso];
  if (colecao && !acao) {
    if (metodo === 'get' && !id) {
      const linhas = visiveis(colecao);
      return colecao === 'categories' && p.type ? linhas.filter((c) => c.type === p.type) : linhas;
    }
    if (metodo === 'post' && !id) {
      const corpo = corpoDe(config);
      // Orçamento de centro de custo é upsert pelo nome do centro.
      if (colecao === 'costCenters') {
        const existente = visiveis('costCenters').find((b) => b.cost_center === corpo.cost_center);
        if (existente) return editar(colecao, existente, corpo);
      }
      return criar(colecao, corpo);
    }
    const linha = visiveis(colecao).find((l) => l.id === id);
    if (!linha) throw new ErroDaApi(404, 'Registro não encontrado');
    if (metodo === 'get') return linha;
    if (metodo === 'put') return editar(colecao, linha, corpoDe(config));
    if (metodo === 'delete') {
      linha[EM_CAMEL.has(colecao) ? 'deletedAt' : 'deleted_at'] = agoraISO();
      return {};
    }
  }

  throw new ErroDaApi(400, INDISPONIVEL);
}

/** Adapter do axios: nenhuma requisição sai do navegador. */
export const adapterEstatico: AxiosAdapter = async (config) => {
  const url = new URL(config.url ?? '', 'http://demo.local');
  const params: Linha = { ...Object.fromEntries(url.searchParams), ...(config.params as Linha) };
  const metodo = (config.method ?? 'get').toLowerCase();
  const caminho = url.pathname.replace(/^\/api/, '');

  try {
    const data = structuredClone(responder(metodo, caminho, params, config));
    return { data, status: 200, statusText: 'OK', headers: {}, config, request: {} };
  } catch (erro) {
    const status = erro instanceof ErroDaApi ? erro.status : 500;
    const mensagem = (erro as Error).message;
    const resposta = {
      data: { error: mensagem },
      status,
      statusText: 'Erro',
      headers: new AxiosHeaders(),
      config,
      request: {},
    };
    throw new AxiosError(mensagem, String(status), config, {}, resposta);
  }
};
