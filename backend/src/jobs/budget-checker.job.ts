import { pool } from '../database/pool';
import { getBudgetStatus } from '../services/budget.service';
import { emailService } from '../services/email.service';

interface UserRow {
  id: string;
  email: string;
}

interface BudgetRow {
  id: string;
  user_id: string;
  category_id: string;
  limit_amount: number;
  period: 'monthly' | 'yearly';
}

export async function checkBudgetsJob(): Promise<void> {
  console.log('[budget-checker] Iniciando verificação de orçamentos...');

  try {
    await emailService.initialize();
  } catch (err) {
    console.warn('[budget-checker] Email service não configurado — alertas desativados:', (err as Error).message);
    return;
  }

  const { rows: budgets } = await pool.query<BudgetRow>(
    'SELECT * FROM budgets WHERE deleted_at IS NULL'
  );

  for (const budget of budgets) {
    try {
      const status = await getBudgetStatus(
        budget.user_id,
        budget.category_id,
        budget.period,
        Number(budget.limit_amount)
      );

      if (!status.isWarning && !status.isExceeded) continue;

      const { rows: users } = await pool.query<UserRow>(
        'SELECT id, email FROM users WHERE id = $1',
        [budget.user_id]
      );
      const user = users[0];
      if (!user) continue;

      const { rows: cats } = await pool.query<{ name: string }>(
        'SELECT name FROM categories WHERE id = $1',
        [budget.category_id]
      );
      const categoryName = cats[0]?.name ?? 'Categoria';

      await emailService.sendBudgetAlert(
        user.email,
        categoryName,
        status.percentage,
        Number(budget.limit_amount),
        status.spent
      );

      console.log(
        `[budget-checker] Alerta enviado para ${user.email} — ${categoryName} (${status.percentage.toFixed(0)}%)`
      );
    } catch (err) {
      console.error(`[budget-checker] Erro ao processar orçamento ${budget.id}:`, err);
    }
  }

  console.log('[budget-checker] Verificação concluída.');
}
