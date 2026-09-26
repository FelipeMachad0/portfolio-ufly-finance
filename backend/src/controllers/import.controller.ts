import type { Request, Response } from 'express';
import { parseCSV, parseXLSX, type ImportRow } from '../utils/csv-parser';
import { pool } from '../database/pool';
import { registrarAuditoria } from '../services/audit.service';

interface PreviewRow extends ImportRow {
  accountId: string | null;
  categoryId: string | null;
  isDuplicate: boolean;
  isValid: boolean;
}

export async function previewImport(req: Request, res: Response): Promise<void> {
  try {
    const file = req.file;
    if (!file) { res.status(400).json({ error: 'Arquivo não fornecido' }); return; }

    let rows: ImportRow[];
    const isCSV = file.mimetype === 'text/csv' || file.originalname.endsWith('.csv');
    if (isCSV) {
      rows = parseCSV(file.buffer.toString('utf-8'));
    } else {
      rows = parseXLSX(file.buffer);
    }

    const userId = req.userId!;

    const [accountsResult, categoriesResult, existingResult] = await Promise.all([
      pool.query<{ id: string; name: string }>('SELECT id, name FROM accounts WHERE deleted_at IS NULL', []),
      pool.query<{ id: string; name: string }>('SELECT id, name FROM categories WHERE deleted_at IS NULL', []),
      pool.query<{ date: string; amount: string; description: string }>(
        'SELECT date, amount, description FROM transactions WHERE deleted_at IS NULL',
        [userId]
      ),
    ]);

    const accounts = accountsResult.rows;
    const categories = categoriesResult.rows;
    const existing = existingResult.rows;

    const preview: PreviewRow[] = rows.map((row) => {
      const account = row.account
        ? accounts.find((a) => a.name.toLowerCase() === row.account!.toLowerCase())
        : accounts[0] ?? null;
      const category = row.category
        ? categories.find((c) => c.name.toLowerCase() === row.category!.toLowerCase())
        : null;

      const isDuplicate = existing.some(
        (t) =>
          new Date(t.date).toDateString() === new Date(row.date).toDateString() &&
          parseFloat(t.amount) === row.amount &&
          t.description === row.description
      );

      return {
        ...row,
        accountId: account?.id ?? null,
        categoryId: category?.id ?? null,
        isDuplicate,
        isValid: !!account?.id && !isNaN(row.amount) && row.amount > 0 && !!row.date,
      };
    });

    res.json({
      totalRows: rows.length,
      duplicates: preview.filter((r) => r.isDuplicate).length,
      rows: preview.slice(0, 50),
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}

export async function importTransactions(req: Request, res: Response): Promise<void> {
  try {
    const { rows } = req.body as { rows: PreviewRow[] };
    if (!Array.isArray(rows)) { res.status(400).json({ error: 'Dados inválidos' }); return; }

    const userId = req.userId!;
    const toImport = rows.filter((r) => !r.isDuplicate && r.isValid);

    let imported = 0;
    for (const row of toImport) {
      const result = await pool.query<{ id: string }>(
        `INSERT INTO transactions (user_id, account_id, category_id, amount, type, description, date, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed')
         RETURNING id`,
        [userId, row.accountId, row.categoryId, row.amount, row.type, row.description, row.date]
      );
      if (result.rows[0]) {
        await registrarAuditoria(userId, 'TRANSACAO_CRIADA', 'transactions', result.rows[0].id, null, row);
        imported++;
      }
    }

    res.json({ success: true, imported, message: `${imported} transações importadas com sucesso` });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
}
