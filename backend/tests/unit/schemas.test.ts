import { describe, it, expect } from 'vitest';
import {
  AccountCreateSchema,
  AccountUpdateSchema,
  CategoryCreateSchema,
  TransactionCreateSchema,
  BudgetCreateSchema,
  BudgetUpdateSchema,
} from '@ufly/shared';

describe('AccountCreateSchema', () => {
  it('valida conta válida', () => {
    const result = AccountCreateSchema.safeParse({ name: 'Nubank', type: 'bank', balance: 1000 });
    expect(result.success).toBe(true);
  });

  it('aplica balance default 0', () => {
    const result = AccountCreateSchema.safeParse({ name: 'Carteira', type: 'wallet' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.balance).toBe(0);
  });

  it('rejeita tipo inválido', () => {
    const result = AccountCreateSchema.safeParse({ name: 'X', type: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('rejeita nome vazio', () => {
    const result = AccountCreateSchema.safeParse({ name: '', type: 'bank' });
    expect(result.success).toBe(false);
  });

  it('rejeita saldo negativo', () => {
    const result = AccountCreateSchema.safeParse({ name: 'X', type: 'bank', balance: -100 });
    expect(result.success).toBe(false);
  });
});

describe('AccountUpdateSchema', () => {
  it('aceita atualização parcial', () => {
    const result = AccountUpdateSchema.safeParse({ name: 'Novo Nome' });
    expect(result.success).toBe(true);
  });

  it('aceita objeto vazio', () => {
    const result = AccountUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe('CategoryCreateSchema', () => {
  it('valida categoria válida', () => {
    const result = CategoryCreateSchema.safeParse({
      name: 'Alimentação',
      type: 'expense',
      color: '#FF0000',
    });
    expect(result.success).toBe(true);
  });

  it('rejeita cor com formato inválido', () => {
    const result = CategoryCreateSchema.safeParse({ name: 'X', type: 'expense', color: 'red' });
    expect(result.success).toBe(false);
  });

  it('aceita ícone opcional', () => {
    const result = CategoryCreateSchema.safeParse({
      name: 'Compras',
      type: 'expense',
      color: '#50A6D2',
      icon: 'shopping-cart',
    });
    expect(result.success).toBe(true);
  });
});

describe('TransactionCreateSchema', () => {
  it('valida transação válida', () => {
    const result = TransactionCreateSchema.safeParse({
      accountId: '550e8400-e29b-41d4-a716-446655440000',
      amount: 150.5,
      type: 'expense',
      description: 'Supermercado',
      date: '2026-05-08',
    });
    expect(result.success).toBe(true);
  });

  it('aplica status default completed', () => {
    const result = TransactionCreateSchema.safeParse({
      accountId: '550e8400-e29b-41d4-a716-446655440000',
      amount: 100,
      type: 'income',
      description: 'Salário',
      date: '2026-05-08',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe('completed');
  });

  it('rejeita amount <= 0', () => {
    const result = TransactionCreateSchema.safeParse({
      accountId: '550e8400-e29b-41d4-a716-446655440000',
      amount: 0,
      type: 'expense',
      description: 'Teste',
      date: '2026-05-08',
    });
    expect(result.success).toBe(false);
  });

  it('rejeita tipo inválido', () => {
    const result = TransactionCreateSchema.safeParse({
      accountId: '550e8400-e29b-41d4-a716-446655440000',
      amount: 100,
      type: 'invalid',
      description: 'Teste',
      date: '2026-05-08',
    });
    expect(result.success).toBe(false);
  });
});

describe('BudgetCreateSchema', () => {
  const validUUID = '550e8400-e29b-41d4-a716-446655440000';

  it('valida orçamento mensal válido', () => {
    const result = BudgetCreateSchema.safeParse({
      categoryId: validUUID,
      limitAmount: 500,
      period: 'monthly',
    });
    expect(result.success).toBe(true);
  });

  it('valida orçamento anual válido', () => {
    const result = BudgetCreateSchema.safeParse({
      categoryId: validUUID,
      limitAmount: 6000,
      period: 'yearly',
    });
    expect(result.success).toBe(true);
  });

  it('rejeita limitAmount <= 0', () => {
    const result = BudgetCreateSchema.safeParse({
      categoryId: validUUID,
      limitAmount: 0,
      period: 'monthly',
    });
    expect(result.success).toBe(false);
  });

  it('rejeita período inválido', () => {
    const result = BudgetCreateSchema.safeParse({
      categoryId: validUUID,
      limitAmount: 500,
      period: 'weekly',
    });
    expect(result.success).toBe(false);
  });

  it('rejeita categoryId inválido', () => {
    const result = BudgetCreateSchema.safeParse({
      categoryId: 'nao-e-uuid',
      limitAmount: 500,
      period: 'monthly',
    });
    expect(result.success).toBe(false);
  });
});

describe('BudgetUpdateSchema', () => {
  it('aceita atualização parcial de limitAmount', () => {
    const result = BudgetUpdateSchema.safeParse({ limitAmount: 800 });
    expect(result.success).toBe(true);
  });

  it('aceita atualização parcial de period', () => {
    const result = BudgetUpdateSchema.safeParse({ period: 'yearly' });
    expect(result.success).toBe(true);
  });

  it('aceita objeto vazio', () => {
    const result = BudgetUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});
