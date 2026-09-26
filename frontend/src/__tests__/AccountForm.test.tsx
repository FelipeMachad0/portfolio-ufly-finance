import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AccountForm } from '../components/financial/AccountForm';

vi.mock('../services/accounts.service', () => ({
  createAccount: vi.fn().mockResolvedValue({ id: '1', name: 'Teste', type: 'bank', balance: 0 }),
}));

describe('AccountForm', () => {
  const onSuccess = vi.fn();
  const onCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza os campos do formulário', () => {
    render(<AccountForm onSuccess={onSuccess} onCancel={onCancel} />);
    expect(screen.getByPlaceholderText(/nubank/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /criar conta/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument();
  });

  it('botão cancelar chama onCancel', () => {
    render(<AccountForm onSuccess={onSuccess} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('mostra erro ao submeter com tipo inválido (sem tipo selecionado)', async () => {
    render(<AccountForm onSuccess={onSuccess} onCancel={onCancel} />);
    fireEvent.change(screen.getByPlaceholderText(/nubank/i), { target: { value: 'Minha Conta' } });
    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid|inválid/i)).toBeInTheDocument();
    });
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('chama onSuccess após submit com dados válidos', async () => {
    render(<AccountForm onSuccess={onSuccess} onCancel={onCancel} />);
    fireEvent.change(screen.getByPlaceholderText(/nubank/i), { target: { value: 'Nubank' } });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'bank' } });
    fireEvent.change(screen.getByDisplayValue('0'), { target: { value: '500' } });
    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledOnce();
    });
  });
});
