import { prisma } from '../database/prisma';
import { generateToken } from '../utils/jwt';
import { createUserWithRole, findUserByEmail } from '../models/user.model';
import { createCliente } from '../models/cliente.model';
import { createAccountService } from './account.service';
import { createCategoryService } from './category.service';
import { createTransactionService } from './transaction.service';
import { upsertBudget } from './cost-center.service';

/**
 * Modo demonstração (versão portfolio).
 *
 * Com `DEMO_MODE=true`, a tela de login ganha o botão "Entrar como
 * demonstração": um clique e a pessoa entra como um usuário fictício, com dados
 * fictícios já cadastrados. Sem a flag, a rota nem é registrada — a autenticação
 * volta a ser só pelo Entra ID.
 */

export const DEMO_EMAIL = 'demo@exemplo.com.br';

export function demoHabilitado(): boolean {
  return process.env.DEMO_MODE === 'true';
}

/** Data ISO no dia `dia` do mês que está `mesesAtras` meses antes do atual. */
function dataRelativa(mesesAtras: number, dia: number): string {
  const hoje = new Date();
  const d = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - mesesAtras, dia));
  // No mês corrente, não lança no futuro.
  if (d > hoje) d.setUTCDate(Math.max(1, hoje.getUTCDate()));
  return d.toISOString().slice(0, 10);
}

/**
 * Cadastra os dados fictícios da demonstração: contas, categorias, clientes e
 * seis meses de lançamentos, terminando no mês atual — assim o dashboard nunca
 * abre vazio, não importa quando a demo for acessada.
 */
async function popularDados(userId: string): Promise<void> {
  const conta = await createAccountService(userId, {
    name: 'Conta Corrente Principal',
    type: 'bank',
    balance: 250000,
  });
  await createAccountService(userId, { name: 'Cartão Corporativo', type: 'credit_card', balance: 0 });

  const categorias: Record<string, string> = {};
  const lista: Array<[string, 'income' | 'expense', string]> = [
    ['Serviços', 'income', '#10B981'],
    ['Produtos', 'income', '#8B5CF6'],
    ['Terceiros', 'expense', '#F97316'],
    ['Impostos', 'expense', '#DC2626'],
    ['Infraestrutura', 'expense', '#3B82F6'],
    ['Outros Gastos', 'expense', '#6B7280'],
  ];
  for (const [name, type, color] of lista) {
    const c = await createCategoryService(userId, { name, type, color });
    categorias[name] = c.id;
  }

  const clientes: Array<[string, string, string]> = [
    ['Cliente Alfa', 'Alfa Varejo LTDA', '11.222.333/0001-81'],
    ['Cliente Beta', 'Beta Logística S/A', '44.555.666/0001-00'],
    ['Cliente Gama', 'Gama Saúde LTDA', '77.888.999/0001-10'],
  ];
  for (const [nome, empresa, cnpj] of clientes) {
    await createCliente(userId, { nome, empresas: [{ nome: empresa, cnpj }] });
  }

  // Orçamento mensal por centro de custo (tela Centros de Custo: previsto x
  // realizado). O prefixo do código é o setor: ADM, COM, DEL ou OPE.
  const centros: Array<[string, string, number]> = [
    ['ADM-01', 'Administrativo', 9000],
    ['COM-01', 'Marketing e eventos', 3000],
    ['DEL-01', 'Infraestrutura de entrega', 6000],
    ['OPE-01', 'Projetos', 22000],
  ];
  for (const [codigo, label, valor] of centros) {
    await upsertBudget(userId, codigo, valor, label, userId);
  }

  type Lancamento = ['income' | 'expense', string, number, string, number, Record<string, string>];
  const lancamentos: Lancamento[] = [];
  for (let m = 5; m >= 0; m--) {
    const f = 6 - m; // cresce mês a mês, para o gráfico ter tendência
    lancamentos.push(['income', 'Serviços', 42000 + f * 1800, 'Projeto de implantação', 5, { cliente: 'Cliente Alfa' }]);
    lancamentos.push(['income', 'Serviços', 18500 + f * 700, 'Suporte mensal', 10, { cliente: 'Cliente Beta' }]);
    if (m % 2 === 0) lancamentos.push(['income', 'Produtos', 12900, 'Licenças de software', 15, { cliente: 'Cliente Gama' }]);
    lancamentos.push(['expense', 'Terceiros', 14200 + f * 300, 'Consultoria terceirizada', 8, { fornecedor: 'Consultoria Exemplo LTDA', centro_custo: 'OPE-01' }]);
    lancamentos.push(['expense', 'Impostos', 6100 + f * 250, 'Tributos do mês', 20, { centro_custo: 'ADM-01' }]);
    lancamentos.push(['expense', 'Infraestrutura', 3800 + f * 150, 'Hospedagem em nuvem', 12, { fornecedor: 'Nuvem Exemplo Serviços LTDA', centro_custo: 'DEL-01' }]);
    lancamentos.push(['expense', 'Outros Gastos', 2150, 'Aluguel do escritório', 5, { fornecedor: 'Imobiliária Exemplo S/A', centro_custo: 'ADM-01' }]);
    lancamentos.push(['expense', 'Outros Gastos', 1500 + f * 200, 'Eventos e marketing digital', 18, { fornecedor: 'Agência Exemplo', centro_custo: 'COM-01' }]);
    for (const [type, cat, amount, description, dia, metadata] of lancamentos.splice(0)) {
      await createTransactionService(userId, {
        accountId: conta.id,
        categoryId: categorias[cat],
        amount,
        type,
        description,
        date: new Date(dataRelativa(m, dia)),
        status: 'completed',
        metadata,
      });
    }
  }
}

/**
 * Garante o usuário demo (e, na primeira vez, os dados fictícios) e devolve a
 * sessão. Idempotente: com o usuário já cadastrado, só emite um novo token.
 */
export async function entrarComoDemo(): Promise<{
  token: string;
  user: { id: string; email: string; name: string; role: string };
}> {
  let user = await findUserByEmail(DEMO_EMAIL);
  if (!user) {
    user = await createUserWithRole({
      email: DEMO_EMAIL,
      name: 'Usuário Demo',
      role: 'GESTOR_GERAL',
    });
  }

  const temDados = (await prisma.transaction.count()) > 0;
  if (!temDados) await popularDados(user.id);

  return {
    token: generateToken({ userId: user.id, email: user.email }),
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  };
}
