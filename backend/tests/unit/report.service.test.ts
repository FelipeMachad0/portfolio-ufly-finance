import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pool } from '../../src/database/pool';
import { getSummary, getExpensesByCategory } from '../../src/services/report.service';

describe('report.service', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  describe('getSummary', () => {
    it('retorna resumo do período', async () => {
      vi.spyOn(pool, 'query').mockResolvedValueOnce({
        rows: [{ total_revenue: '5000', total_expense: '3000', transaction_count: '10' }],
        rowCount: 1,
      } as never);

      const result = await getSummary('user-1', new Date('2024-01-01'), new Date('2024-12-31'));

      expect(result.totalRevenue).toBe(5000);
      expect(result.totalExpense).toBe(3000);
      expect(result.balance).toBe(2000);
      expect(result.transactionCount).toBe(10);
    });

    it('retorna zeros quando não há transações', async () => {
      vi.spyOn(pool, 'query').mockResolvedValueOnce({
        rows: [{ total_revenue: null, total_expense: null, transaction_count: '0' }],
        rowCount: 1,
      } as never);

      const result = await getSummary('user-1', new Date('2024-01-01'), new Date('2024-12-31'));

      expect(result.totalRevenue).toBe(0);
      expect(result.totalExpense).toBe(0);
      expect(result.balance).toBe(0);
    });
  });

  describe('getExpensesByCategory', () => {
    it('retorna lista de categorias com totais', async () => {
      vi.spyOn(pool, 'query').mockResolvedValueOnce({
        rows: [
          { id: 'cat-1', name: 'Alimentação', color: '#red', total: 500 },
          { id: 'cat-2', name: 'Transporte', color: '#blue', total: 200 },
        ],
        rowCount: 2,
      } as never);

      const result = await getExpensesByCategory('user-1', new Date(), new Date());

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Alimentação');
      expect(result[0].total).toBe(500);
    });
  });
});
