import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TransactionForm } from '../components/financial/TransactionForm';
import * as accountsService from '../services/accounts.service';
import * as categoriesService from '../services/categories.service';

vi.mock('../services/accounts.service');
vi.mock('../services/categories.service');
vi.mock('../services/transactions.service');

describe('TransactionForm', () => {
  beforeEach(() => {
    vi.mocked(accountsService.getAccounts).mockResolvedValue([]);
    vi.mocked(categoriesService.getCategories).mockResolvedValue([]);
  });

  it('renderiza os campos do formulário', () => {
    render(<TransactionForm onSuccess={vi.fn()} onCancel={vi.fn()} />);
    // O seletor de "Tipo" deixou de existir: o tipo passou a ser derivado da
    // categoria escolhida. A categoria é que precisa estar no formulário.
    expect(screen.getByText('Categoria')).toBeInTheDocument();
    expect(screen.getByText('Valor (R$)')).toBeInTheDocument();
    expect(screen.getByText('Descrição')).toBeInTheDocument();
    expect(screen.getByText('Conta')).toBeInTheDocument();
    expect(screen.getByText('Data')).toBeInTheDocument();
  });

  it('exibe botão de criar transação', () => {
    render(<TransactionForm onSuccess={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: /criar transação/i })).toBeInTheDocument();
  });

  it('exibe botão de cancelar', () => {
    render(<TransactionForm onSuccess={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument();
  });

  it('chama onCancel ao clicar cancelar', async () => {
    const mockCancel = vi.fn();
    const { getByRole } = render(<TransactionForm onSuccess={vi.fn()} onCancel={mockCancel} />);
    getByRole('button', { name: /cancelar/i }).click();
    expect(mockCancel).toHaveBeenCalled();
  });
});
