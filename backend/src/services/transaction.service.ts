import { TransactionCreate, TransactionUpdate } from '@ufly/shared';
import {
  findTransactions,
  findTransactionById,
  createTransaction,
  updateTransaction,
  softDeleteTransaction,
  TransactionFilters,
} from '../models/transaction.model';
import { findAccountById, adjustAccountBalance } from '../models/account.model';
import { registrarAuditoria } from './audit.service';

export async function listTransactions(
  userId: string,
  filters: TransactionFilters,
  page: number,
  limit: number
) {
  return findTransactions(filters, page, limit);
}

export async function getTransaction(id: string, userId: string) {
  const tx = await findTransactionById(id, userId);
  if (!tx) throw new Error('Transação não encontrada');
  return tx;
}

export async function createTransactionService(userId: string, data: TransactionCreate) {
  const account = await findAccountById(data.accountId, userId);
  if (!account) throw new Error('Conta não encontrada');

  const tx = await createTransaction(userId, data);

  if (tx.status === 'completed') {
    const delta = tx.type === 'income' ? tx.amount : -tx.amount;
    if (tx.type !== 'transfer') await adjustAccountBalance(tx.account_id, delta);
  }

  await registrarAuditoria(userId, 'TRANSACAO_CRIADA', 'transactions', tx.id, null, tx);
  return tx;
}

export async function updateTransactionService(id: string, userId: string, data: TransactionUpdate) {
  const before = await findTransactionById(id, userId);
  if (!before) throw new Error('Transação não encontrada');

  // Reverter impacto anterior no saldo (se estava completed)
  if (before.status === 'completed' && before.type !== 'transfer' && data.amount !== undefined) {
    const revert = before.type === 'income' ? -before.amount : before.amount;
    await adjustAccountBalance(before.account_id, revert);
  }

  const tx = await updateTransaction(id, userId, data);
  if (!tx) throw new Error('Falha ao atualizar transação');

  // Aplicar novo impacto no saldo
  if (tx.status === 'completed' && tx.type !== 'transfer' && data.amount !== undefined) {
    const delta = tx.type === 'income' ? tx.amount : -tx.amount;
    await adjustAccountBalance(tx.account_id, delta);
  }

  await registrarAuditoria(userId, 'TRANSACAO_EDITADA', 'transactions', id, before, tx);
  return tx;
}

export async function deleteTransactionService(id: string, userId: string) {
  const before = await findTransactionById(id, userId);
  if (!before) throw new Error('Transação não encontrada');

  // Reverter saldo ao deletar
  if (before.status === 'completed' && before.type !== 'transfer') {
    const revert = before.type === 'income' ? -before.amount : before.amount;
    await adjustAccountBalance(before.account_id, revert);
  }

  const deleted = await softDeleteTransaction(id, userId);
  if (deleted) await registrarAuditoria(userId, 'TRANSACAO_DELETADA', 'transactions', id, before, null);
  return deleted;
}
