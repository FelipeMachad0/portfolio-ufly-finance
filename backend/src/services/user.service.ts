import type { UserCreate, UserUpdate } from '@ufly/shared';
import {
  findUsers,
  findUserById,
  findUserByEmail,
  createUserWithRole,
  reactivateUser,
  updateUserRecord,
  softDeleteUser,
  type User,
  type UserFilters,
} from '../models/user.model';
import { registrarAuditoria } from './audit.service';

export async function listUsers(filters: UserFilters): Promise<User[]> {
  return findUsers(filters);
}

export async function getUser(id: string): Promise<User> {
  const user = await findUserById(id);
  if (!user) throw new Error('Usuário não encontrado');
  return user;
}

export interface CreatedUserResult {
  user: User;
}

export async function createUserService(
  actorId: string,
  data: UserCreate,
): Promise<CreatedUserResult> {
  const existing = await findUserByEmail(data.email);
  if (existing && existing.deleted_at === null) {
    throw new Error('Este e-mail já está cadastrado.');
  }
  // Já existiu e foi excluído: reativa em vez de inserir. O índice único do
  // e-mail não conhece `deleted_at`, então o INSERT colidia e o erro cru do
  // Prisma ("Unique constraint failed on the fields: (email)") aparecia na tela.
  // Reativar também mantém o id, preservando o que estava atribuído à pessoa.
  if (existing) {
    const reativado = await reactivateUser({
      id: existing.id,
      name: data.name,
      role: data.role,
    });
    await registrarAuditoria(actorId, 'USUARIO_EDITADO', 'users', reativado.id, existing, {
      ...reativado,
      motivo: 'usuário reativado ao ser cadastrado novamente com o mesmo e-mail',
    });
    return { user: reativado };
  }
  // Usuário nasce SEM senha. O acesso é pelo Entra ID: a pessoa entra com a
  // conta Microsoft dela e o vínculo acontece pelo e-mail.
  //
  // Antes, toda criação gravava o hash de uma senha padrão igual para todo mundo
  // ('ufly123'), e o endpoint de login por senha — público — aceitava esse hash.
  // Na prática era credencial conhecida para qualquer conta criada, num serviço
  // exposto na internet.
  //
  // O login por senha continua existindo como saída de emergência, mas só
  // funciona para conta que tenha recebido uma senha DELIBERADAMENTE.
  const user = await createUserWithRole({
    email: data.email,
    name: data.name,
    role: data.role,
  });
  await registrarAuditoria(actorId, 'USUARIO_CRIADO', 'users', user.id, null, user);
  return { user };
}

export async function updateUserService(actorId: string, id: string, data: UserUpdate): Promise<User> {
  const before = await findUserById(id);
  if (!before) throw new Error('Usuário não encontrado');
  const updated = await updateUserRecord(id, data);
  if (!updated) throw new Error('Falha ao atualizar usuário');
  await registrarAuditoria(actorId, 'USUARIO_EDITADO', 'users', id, before, updated);
  return updated;
}

export async function deleteUserService(actorId: string, id: string): Promise<void> {
  if (actorId === id) throw new Error('Não é possível excluir o próprio usuário');
  const before = await findUserById(id);
  if (!before) throw new Error('Usuário não encontrado');
  await softDeleteUser(id);
  await registrarAuditoria(actorId, 'USUARIO_DELETADO', 'users', id, before, null);
}
