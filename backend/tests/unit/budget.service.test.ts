import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/models/budget.model', () => ({
  getCategorySpending: vi.fn(),
}));

import { getCategorySpending } from '../../src/models/budget.model';
import { getBudgetStatus } from '../../src/services/budget.service';

describe('budget.service - getBudgetStatus', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('calcula percentual corretamente', async () => {
    vi.mocked(getCategorySpending).mockResolvedValueOnce(800);

    const status = await getBudgetStatus('user-1', 'cat-1', 'monthly', 1000);

    expect(status.spent).toBe(800);
    expect(status.percentage).toBe(80);
    expect(status.isWarning).toBe(true);
    expect(status.isExceeded).toBe(false);
    expect(status.remaining).toBe(200);
  });

  it('marca como excedido quando gasto > limite', async () => {
    vi.mocked(getCategorySpending).mockResolvedValueOnce(1200);

    const status = await getBudgetStatus('user-1', 'cat-1', 'monthly', 1000);

    expect(status.isExceeded).toBe(true);
    expect(status.percentage).toBe(100); // capped
    expect(status.remaining).toBe(0);    // Math.max(0, ...)
  });

  it('retorna zeros quando limitAmount é 0', async () => {
    vi.mocked(getCategorySpending).mockResolvedValueOnce(0);

    const status = await getBudgetStatus('user-1', 'cat-1', 'monthly', 0);

    expect(status.percentage).toBe(0);
    expect(status.isWarning).toBe(false);
  });
});
