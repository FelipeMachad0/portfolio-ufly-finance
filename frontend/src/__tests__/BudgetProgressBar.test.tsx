import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BudgetProgressBar } from '../components/financial/BudgetProgressBar';
import type { BudgetWithStatus } from '../services/budgets.service';

const base: BudgetWithStatus = {
  id: 'budget-1',
  user_id: 'user-1',
  category_id: 'cat-1',
  category_name: 'Alimentação',
  category_color: '#10B981',
  limit_amount: 1000,
  period: 'monthly',
  spent: 500,
  remaining: 500,
  percentage: 50,
  isWarning: false,
  isExceeded: false,
};

describe('BudgetProgressBar', () => {
  it('renderiza nome da categoria e valores', () => {
    render(<BudgetProgressBar budget={base} />);
    expect(screen.getByText('Alimentação')).toBeInTheDocument();
    expect(screen.getByText(/Mensal/i)).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('mostra aviso quando isWarning = true', () => {
    render(<BudgetProgressBar budget={{ ...base, percentage: 85, spent: 850, remaining: 150, isWarning: true }} />);
    expect(screen.getByText(/Aproximando do limite/i)).toBeInTheDocument();
  });

  it('mostra excedido quando isExceeded = true', () => {
    render(<BudgetProgressBar budget={{ ...base, percentage: 100, spent: 1000, remaining: 0, isWarning: true, isExceeded: true }} />);
    expect(screen.getByText(/Orçamento excedido/i)).toBeInTheDocument();
  });

  it('chama onDelete ao clicar no botão remover', () => {
    const onDelete = vi.fn();
    render(<BudgetProgressBar budget={base} onDelete={onDelete} />);
    fireEvent.click(screen.getByText('✕'));
    expect(onDelete).toHaveBeenCalledWith('budget-1');
  });

  it('não mostra botão remover quando onDelete não é fornecido', () => {
    render(<BudgetProgressBar budget={base} />);
    expect(screen.queryByText('✕')).not.toBeInTheDocument();
  });
});
