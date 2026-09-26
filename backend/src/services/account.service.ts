import { AccountCreate, AccountUpdate } from '@ufly/shared';
import {
  findAccounts,
  findAccountById,
  createAccount,
  updateAccount,
  softDeleteAccount,
} from '../models/account.model';
import { registrarAuditoria } from './audit.service';

export async function listAccounts(userId: string) {
  return findAccounts();
}

export async function getAccount(id: string, userId: string) {
  const account = await findAccountById(id, userId);
  if (!account) throw new Error('Conta não encontrada');
  return account;
}

export async function createAccountService(userId: string, data: AccountCreate) {
  const account = await createAccount(userId, data);
  await registrarAuditoria(userId, 'CONTA_CRIADA', 'accounts', account.id, null, account);
  return account;
}

export async function updateAccountService(id: string, userId: string, data: AccountUpdate) {
  const before = await findAccountById(id, userId);
  if (!before) throw new Error('Conta não encontrada');

  const account = await updateAccount(id, userId, data);
  if (account) await registrarAuditoria(userId, 'CONTA_EDITADA', 'accounts', id, before, account);
  return account;
}

export async function deleteAccountService(id: string, userId: string) {
  const before = await findAccountById(id, userId);
  if (!before) throw new Error('Conta não encontrada');

  const deleted = await softDeleteAccount(id, userId);
  if (deleted) await registrarAuditoria(userId, 'CONTA_DELETADA', 'accounts', id, before, null);
  return deleted;
}
