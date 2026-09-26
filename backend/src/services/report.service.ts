import { pool } from '../database/pool';
import { filtroDePeriodo } from '../utils/date-range';

export interface CategoryExpense {
  id: string;
  name: string;
  color: string;
  total: number;
}

export interface MonthlyData {
  month: string;
  revenue: number;
  expense: number;
}

export interface PeriodSummary {
  totalRevenue: number;
  totalExpense: number;
  balance: number;
  transactionCount: number;
}

export async function getExpensesByCategory(
  userId: string,
  startDate?: Date,
  endDate?: Date
): Promise<CategoryExpense[]> {
  const params: unknown[] = [];
  const filtro = filtroDePeriodo('t.date', params, startDate, endDate);
  const result = await pool.query<CategoryExpense>(
    `SELECT
       c.id,
       c.name,
       COALESCE(c.color, '#6B7280') as color,
       SUM(t.amount)::float as total
     FROM transactions t
     JOIN categories c ON t.category_id = c.id
     WHERE t.type = 'expense'
       AND t.status = 'completed'
       ${filtro}
       AND t.deleted_at IS NULL
     GROUP BY c.id, c.name, c.color
     ORDER BY total DESC`,
    params
  );
  return result.rows;
}

export interface ClientRevenue {
  cliente: string;
  total: number;
}

/**
 * Agrupa receitas (income) por cliente extraído de metadata.cliente.
 * Transações sem cliente (ou com cliente vazio) entram em "Sem cliente".
 */
export async function getRevenueByClient(
  userId: string,
  startDate?: Date,
  endDate?: Date
): Promise<ClientRevenue[]> {
  const params: unknown[] = [];
  const filtro = filtroDePeriodo('date', params, startDate, endDate);
  const result = await pool.query<{ cliente: string; total: string }>(
    `SELECT
       COALESCE(NULLIF(TRIM(metadata->>'cliente'), ''), 'Sem cliente') AS cliente,
       SUM(amount)::float AS total
     FROM transactions
     WHERE type = 'income'
       AND status = 'completed'
       ${filtro}
       AND deleted_at IS NULL
     GROUP BY 1
     ORDER BY total DESC`,
    params
  );
  return result.rows.map((r) => ({
    cliente: r.cliente,
    total: Number(r.total),
  }));
}

export async function getRevenueVsExpense(
  userId: string,
  startDate?: Date,
  endDate?: Date,
  granularity: 'day' | 'month' = 'month'
): Promise<MonthlyData[]> {
  const trunc = granularity === 'day' ? 'day' : 'month';
  const params: unknown[] = [];
  const filtro = filtroDePeriodo('date', params, startDate, endDate);
  const result = await pool.query<{ bucket: Date; revenue: string; expense: string }>(
    `SELECT
       DATE_TRUNC('${trunc}', date) as bucket,
       SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END)::float as revenue,
       SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END)::float as expense
     FROM transactions
     WHERE status = 'completed'
       ${filtro}
       AND deleted_at IS NULL
     GROUP BY DATE_TRUNC('${trunc}', date)
     ORDER BY bucket`,
    params
  );

  return result.rows.map((r) => {
    const d = new Date(r.bucket);
    // timeZone: 'UTC' evita que datas à meia-noite UTC sejam deslocadas
    // para o dia anterior no fuso de Brasília (UTC-3)
    const label = granularity === 'day'
      ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' })
      : d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' });
    return {
      month: label,
      revenue: Number(r.revenue),
      expense: Number(r.expense),
    };
  });
}

export async function getSummary(
  userId: string,
  startDate?: Date,
  endDate?: Date
): Promise<PeriodSummary> {
  const params: unknown[] = [];
  const filtro = filtroDePeriodo('date', params, startDate, endDate);
  const result = await pool.query<{
    total_revenue: string;
    total_expense: string;
    transaction_count: string;
  }>(
    `SELECT
       SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END)::float as total_revenue,
       SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END)::float as total_expense,
       COUNT(*) as transaction_count
     FROM transactions
     WHERE status = 'completed'
       ${filtro}
       AND deleted_at IS NULL`,
    params
  );
  const row = result.rows[0];
  const totalRevenue = Number(row?.total_revenue ?? 0);
  const totalExpense = Number(row?.total_expense ?? 0);
  return {
    totalRevenue,
    totalExpense,
    balance: totalRevenue - totalExpense,
    transactionCount: Number(row?.transaction_count ?? 0),
  };
}

// ════════════════════════════════════════════════════════════
// DRE — Demonstração do Resultado do Exercício
// ════════════════════════════════════════════════════════════

export type DreSection =
  | 'receita_servicos'
  | 'receita_produtos'
  | 'deducoes'
  | 'cpv_terceiros'
  | 'cpv_licencas'
  | 'cpv_infra'
  | 'desp_consultoria'
  | 'desp_marketing'
  | 'desp_outros'
  | 'distribuicao_socios'
  | 'emprestimos'
  | 'outros';

/**
 * Mapeia nome de categoria → seção DRE.
 * Funciona por palavras-chave (case-insensitive) para acomodar variações.
 */
export function categoryToDreSection(
  categoryName: string | null,
  type: 'income' | 'expense' | 'transfer'
): DreSection {
  const name = (categoryName ?? '').toLowerCase();

  if (type === 'income') {
    if (name.includes('produto') || name.includes('licença') || name.includes('licenca')) {
      return 'receita_produtos';
    }
    return 'receita_servicos';
  }

  if (type === 'expense') {
    if (name.includes('iss') || name.includes('pis') || name.includes('cofins') || name.includes('irrf')) {
      return 'deducoes';
    }
    if (name.includes('imposto')) return 'deducoes';
    if (name.includes('terceiro') || name.includes('parceiro')) return 'cpv_terceiros';
    if (name.includes('licença') || name.includes('licenca')) return 'cpv_licencas';
    if (name.includes('infra') || name.includes('nuvem') || name.includes('cloud')) {
      return 'cpv_infra';
    }
    if (name.includes('consultoria')) return 'desp_consultoria';
    if (name.includes('marketing') || name.includes('publicidade')) return 'desp_marketing';
    if (name.includes('sócio') || name.includes('socio') || name.includes('distribuição') || name.includes('distribuicao')) {
      return 'distribuicao_socios';
    }
    if (name.includes('empréstimo') || name.includes('emprestimo')) return 'emprestimos';
    return 'desp_outros';
  }

  return 'outros';
}

export interface DreMonthBucket {
  month: string;                // 'YYYY-MM'
  monthLabel: string;           // 'Jan/26'
  sections: Record<DreSection, number>;
}

export interface DreReport {
  months: DreMonthBucket[];
  totals: Record<DreSection, number>;
  computedAt: string;
}

const ALL_SECTIONS: DreSection[] = [
  'receita_servicos',
  'receita_produtos',
  'deducoes',
  'cpv_terceiros',
  'cpv_licencas',
  'cpv_infra',
  'desp_consultoria',
  'desp_marketing',
  'desp_outros',
  'distribuicao_socios',
  'emprestimos',
  'outros',
];

function emptySections(): Record<DreSection, number> {
  return ALL_SECTIONS.reduce(
    (acc, s) => ({ ...acc, [s]: 0 }),
    {} as Record<DreSection, number>,
  );
}

export async function getDRE(
  userId: string,
  startDate?: Date,
  endDate?: Date,
): Promise<DreReport> {
  const params: unknown[] = [];
  const filtro = filtroDePeriodo('t.date', params, startDate, endDate);
  const result = await pool.query<{
    month: Date;
    type: 'income' | 'expense' | 'transfer';
    category_name: string | null;
    total: string;
  }>(
    `SELECT
       DATE_TRUNC('month', t.date) as month,
       t.type,
       c.name as category_name,
       SUM(t.amount)::float as total
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.id
     WHERE t.status = 'completed'
       ${filtro}
       AND t.deleted_at IS NULL
       AND t.type IN ('income', 'expense')
     GROUP BY DATE_TRUNC('month', t.date), t.type, c.name
     ORDER BY month`,
    params,
  );

  // Bucket por mês
  const monthMap = new Map<string, DreMonthBucket>();
  const totals = emptySections();

  for (const row of result.rows) {
    const monthKey = new Date(row.month).toISOString().slice(0, 7); // YYYY-MM
    const monthLabel = new Date(row.month).toLocaleDateString('pt-BR', {
      month: 'short',
      year: '2-digit',
    });

    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, {
        month: monthKey,
        monthLabel,
        sections: emptySections(),
      });
    }

    const bucket = monthMap.get(monthKey)!;
    const section = categoryToDreSection(row.category_name, row.type);
    const value = Number(row.total);

    bucket.sections[section] += value;
    totals[section] += value;
  }

  return {
    months: Array.from(monthMap.values()).sort((a, b) =>
      a.month.localeCompare(b.month),
    ),
    totals,
    computedAt: new Date().toISOString(),
  };
}
