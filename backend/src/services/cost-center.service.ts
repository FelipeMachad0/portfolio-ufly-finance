import { pool } from '../database/pool';
import { filtroDePeriodo } from '../utils/date-range';

export interface CostCenterBudget {
  id: string;
  user_id: string;
  cost_center: string;
  label: string | null;
  monthly_amount: number;
  gestor_user_id: string | null;
  gestor_name: string | null;
  gestor_email: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CostCenterComparison {
  cost_center: string;
  label: string | null;
  previsto: number;
  realizado: number;
  /** Total gasto histórico nesse CC (sem filtro de período). */
  acumulado: number;
  diferenca: number;
  /** % usado: (realizado / previsto) * 100. null se previsto = 0. */
  uso_pct: number | null;
}

// ── CRUD ────────────────────────────────────────────────────────────────────

const SELECT_BUDGET = `
  SELECT
    ccb.id, ccb.user_id, ccb.cost_center, ccb.label,
    ccb.monthly_amount::float AS monthly_amount,
    ccb.gestor_user_id,
    u.name AS gestor_name,
    u.email AS gestor_email,
    ccb.created_at, ccb.updated_at
  FROM cost_center_budgets ccb
  LEFT JOIN users u ON u.id = ccb.gestor_user_id
`;

export async function listBudgets(): Promise<CostCenterBudget[]> {
  const r = await pool.query<CostCenterBudget>(
    `${SELECT_BUDGET}
     WHERE ccb.deleted_at IS NULL
     ORDER BY ccb.cost_center ASC`,
    []
  );
  return r.rows;
}

export async function upsertBudget(
  userId: string,
  costCenter: string,
  monthlyAmount: number,
  label: string | null,
  gestorUserId: string | null
): Promise<CostCenterBudget> {
  // Um centro de custo tem UM orçamento na plataforma, não um por usuário.
  const existente = await pool.query<{ id: string }>(
    `SELECT id FROM cost_center_budgets WHERE cost_center = $1 LIMIT 1`,
    [costCenter]
  );
  let id: string;
  if (existente.rows[0]) {
    id = existente.rows[0].id;
    await pool.query(
      `UPDATE cost_center_budgets
          SET label = $2, monthly_amount = $3, gestor_user_id = $4,
              deleted_at = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1`,
      [id, label, monthlyAmount, gestorUserId]
    );
  } else {
    const ins = await pool.query<{ id: string }>(
      `INSERT INTO cost_center_budgets (user_id, cost_center, label, monthly_amount, gestor_user_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [userId, costCenter, label, monthlyAmount, gestorUserId]
    );
    id = ins.rows[0].id;
  }
  const r = await pool.query<CostCenterBudget>(
    `${SELECT_BUDGET} WHERE ccb.id = $1`,
    [id]
  );
  return r.rows[0];
}

export async function deleteBudget(id: string): Promise<boolean> {
  const r = await pool.query(
    `UPDATE cost_center_budgets SET deleted_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  return (r.rowCount ?? 0) > 0;
}

// ── Previsto x Realizado ────────────────────────────────────────────────────

/** Meses cobertos pelo histórico de despesas; 0 se não houver nenhuma. */
async function mesesDeHistoricoDeDespesa(): Promise<number> {
  const r = await pool.query<{ inicio: Date | null; fim: Date | null }>(
    `SELECT MIN(date) AS inicio, MAX(date) AS fim
       FROM transactions
      WHERE type = 'expense' AND status = 'completed' AND deleted_at IS NULL`
  );
  const { inicio, fim } = r.rows[0] ?? { inicio: null, fim: null };
  if (!inicio || !fim) return 0;
  // +1ms porque monthsInRange desconta 1ms do fim para não invadir o mês seguinte.
  return monthsInRange(new Date(inicio), new Date(new Date(fim).getTime() + 1));
}

/**
 * Conta a fração de meses que o intervalo cobre, proporcional ao número
 * de dias em cada mês tocado. Exemplo:
 *  - 15 mar → 30 abr: 17/31 + 30/30 = 1,548 meses
 *  - "Este mês" inteiro: 1.0
 *  - "Este ano": 12.0
 *
 * Trabalha em horário local (Brasília) — o servidor roda no mesmo TZ.
 */
function monthsInRange(start: Date, end: Date): number {
  // Subtrai 1ms do fim pra cair dentro do último mês (não no 00:00 do próximo)
  const adjEnd = new Date(end.getTime() - 1);
  if (adjEnd < start) return 0;

  let total = 0;
  let cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());

  while (cursor <= adjEnd) {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    // Último dia do mês atual (local)
    const monthEnd = new Date(y, m + 1, 0, 23, 59, 59, 999);
    // Quanto deste mês está dentro do intervalo
    const segmentEnd = adjEnd < monthEnd ? adjEnd : monthEnd;
    const daysInThisMonth = new Date(y, m + 1, 0).getDate();
    // Dias contados: da posição atual até segmentEnd
    const startDay = cursor.getDate();
    const endDay = segmentEnd.getDate();
    const includedDays = endDay - startDay + 1;
    total += includedDays / daysInThisMonth;
    // Próximo mês, dia 1
    cursor = new Date(y, m + 1, 1);
  }
  return total;
}

/**
 * Devolve Previsto x Realizado por centro de custo dentro do período.
 *  - "previsto" = monthly_amount × meses proporcionais no intervalo
 *  - "realizado" = SUM(amount) das transactions no período
 *  - "acumulado" = SUM(amount) de TODAS as transactions do CC (histórico)
 */
export async function getComparison(
  userId: string,
  startDate?: Date,
  endDate?: Date
): Promise<CostCenterComparison[]> {
  // Sem período ("Tudo"), "previsto" precisa de algum intervalo para multiplicar
  // o orçamento mensal: usa-se o histórico real de despesas, o que deixa a
  // coluna coerente com "acumulado", que já cobre todo o histórico.
  const months =
    startDate && endDate
      ? monthsInRange(startDate, endDate)
      : await mesesDeHistoricoDeDespesa();

  const params: unknown[] = [];
  const filtroRealizado = filtroDePeriodo('date', params, startDate, endDate);

  const r = await pool.query<{
    cost_center: string;
    label: string | null;
    monthly_amount: string | null;
    realizado: string | null;
    acumulado: string | null;
  }>(
    `
    WITH budgets AS (
      SELECT cost_center, label, monthly_amount::float AS monthly_amount
      FROM cost_center_budgets
      WHERE deleted_at IS NULL
    ),
    actuals_period AS (
      SELECT TRIM(metadata->>'centro_custo') AS cost_center,
             SUM(amount)::float AS realizado
      FROM transactions
      WHERE type = 'expense'
        AND status = 'completed'
        AND deleted_at IS NULL
        ${filtroRealizado}
        AND TRIM(COALESCE(metadata->>'centro_custo', '')) <> ''
      GROUP BY 1
    ),
    actuals_all AS (
      SELECT TRIM(metadata->>'centro_custo') AS cost_center,
             SUM(amount)::float AS acumulado
      FROM transactions
      WHERE type = 'expense'
        AND status = 'completed'
        AND deleted_at IS NULL
        AND TRIM(COALESCE(metadata->>'centro_custo', '')) <> ''
      GROUP BY 1
    )
    SELECT
      COALESCE(b.cost_center, a.cost_center, t.cost_center) AS cost_center,
      b.label,
      b.monthly_amount,
      a.realizado,
      t.acumulado
    FROM budgets b
    FULL OUTER JOIN actuals_period a ON a.cost_center = b.cost_center
    FULL OUTER JOIN actuals_all t ON t.cost_center = COALESCE(b.cost_center, a.cost_center)
    ORDER BY 1
    `,
    params
  );

  return r.rows.map((row) => {
    const monthlyPrevisto = Number(row.monthly_amount ?? 0);
    const previsto = Number((monthlyPrevisto * months).toFixed(2));
    const realizado = Number(row.realizado ?? 0);
    const acumulado = Number(row.acumulado ?? 0);
    return {
      cost_center: row.cost_center,
      label: row.label,
      previsto,
      realizado,
      acumulado,
      diferenca: previsto - realizado,
      uso_pct: previsto > 0 ? (realizado / previsto) * 100 : null,
    };
  });
}
