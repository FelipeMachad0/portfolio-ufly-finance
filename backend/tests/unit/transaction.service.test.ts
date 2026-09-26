import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/services/audit.service', () => ({
  registrarAuditoria: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../src/models/transaction.model', () => ({
  findTransactions: vi.fn(),
  findTransactionById: vi.fn(),
  createTransaction: vi.fn(),
  softDeleteTransaction: vi.fn(),
}));
vi.mock('../../src/models/account.model', () => ({
  findAccountById: vi.fn(),
  adjustAccountBalance: vi.fn().mockResolvedValue(undefined),
}));

import {
  findTransactions,
  findTransactionById,
  createTransaction,
} from '../../src/models/transaction.model';
import { findAccountById } from '../../src/models/account.model';
import {
  createTransactionService,
  listTransactions,
  deleteTransactionService,
} from '../../src/services/transaction.service';

describe('transaction.service', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('listTransactions', () => {
    it('retorna dados paginados', async () => {
      vi.mocked(findTransactions).mockResolvedValueOnce({
        data: [{ id: 't1', amount: 100 }] as never,
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      const result = await listTransactions('user-1', {}, 1, 20);
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });
  });

  describe('createTransactionService', () => {
    it('lança erro se conta não encontrada', async () => {
      vi.mocked(findAccountById).mockResolvedValueOnce(null);

      await expect(
        createTransactionService('user-1', {
          accountId: 'nonexistent',
          amount: 100,
          type: 'expense',
          description: 'Teste',
          date: new Date(),
          status: 'completed',
        })
      ).rejects.toThrow('Conta não encontrada');
    });

    it('cria transação com sucesso', async () => {
      const fakeAccount = { id: 'acc-1', user_id: 'user-1', balance: 1000, type: 'bank', deleted_at: null };
      const fakeTx = { id: 'tx-1', user_id: 'user-1', account_id: 'acc-1', amount: 100, type: 'expense', status: 'completed' };
      vi.mocked(findAccountById).mockResolvedValueOnce(fakeAccount as never);
      vi.mocked(createTransaction).mockResolvedValueOnce(fakeTx as never);

      const result = await createTransactionService('user-1', {
        accountId: 'acc-1',
        amount: 100,
        type: 'expense',
        description: 'Teste',
        date: new Date(),
        status: 'completed',
      });

      expect(result.id).toBe('tx-1');
    });
  });

  describe('deleteTransactionService', () => {
    it('lança erro se transação não encontrada', async () => {
      vi.mocked(findTransactionById).mockResolvedValueOnce(null);

      await expect(deleteTransactionService('nonexistent', 'user-1')).rejects.toThrow('Transação não encontrada');
    });
  });
});
