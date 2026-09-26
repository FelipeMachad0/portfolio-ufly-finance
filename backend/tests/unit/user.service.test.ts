import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/services/audit.service', () => ({
  registrarAuditoria: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../src/models/user.model', () => ({
  findUsers: vi.fn(),
  findUserById: vi.fn(),
  findUserByEmail: vi.fn(),
  createUserWithRole: vi.fn(),
  reactivateUser: vi.fn(),
  updateUserRecord: vi.fn(),
  softDeleteUser: vi.fn(),
}));

import {
  findUsers,
  findUserById,
  findUserByEmail,
  createUserWithRole,
  reactivateUser,
} from '../../src/models/user.model';
import {
  listUsers,
  createUserService,
  updateUserService,
  deleteUserService,
} from '../../src/services/user.service';

describe('user.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listUsers retorna registros do banco', async () => {
    const fake = [{ id: 'u1', email: 'a@a.com', name: 'A' }];
    vi.mocked(findUsers).mockResolvedValueOnce(fake as never);

    const rows = await listUsers({});
    expect(rows).toEqual(fake);
  });

  it('createUserService lança quando email já existe', async () => {
    vi.mocked(findUserByEmail).mockResolvedValueOnce({
      id: 'u1', email: 'a@a.com', name: 'Existing', deleted_at: null,
    } as never);

    await expect(
      createUserService('actor-1', { email: 'a@a.com', name: 'Novo', role: 'USUARIO' })
    ).rejects.toThrow('Este e-mail já está cadastrado.');
  });

  it('createUserService reativa usuário que havia sido excluído', async () => {
    // O índice único do e-mail não conhece `deleted_at`: recriar alguém removido
    // colidia no INSERT e o erro cru do Prisma aparecia na tela do cadastro.
    // Reativar preserva o id, mantendo coerente o que estava atribuído à pessoa.
    vi.mocked(findUserByEmail).mockResolvedValueOnce({
      id: 'u9', email: 'c@c.com', name: 'Antigo', deleted_at: new Date(),
    } as never);
    const reativado = { id: 'u9', email: 'c@c.com', name: 'Novo Nome', role: 'GESTOR_GERAL' };
    vi.mocked(reactivateUser).mockResolvedValueOnce(reativado as never);

    const { user } = await createUserService('actor-1', {
      email: 'c@c.com',
      name: 'Novo Nome',
      role: 'GESTOR_GERAL',
    });

    expect(user).toEqual(reativado);
    expect(reactivateUser).toHaveBeenCalledWith({
      id: 'u9',
      name: 'Novo Nome',
      role: 'GESTOR_GERAL',
    });
    // Não pode inserir: seria a colisão de e-mail.
    expect(createUserWithRole).not.toHaveBeenCalled();
  });

  it('createUserService cria novo usuário quando email é livre', async () => {
    const created = { id: 'u2', email: 'b@b.com', name: 'B', role: 'USUARIO' };
    vi.mocked(findUserByEmail).mockResolvedValueOnce(null);
    vi.mocked(createUserWithRole).mockResolvedValueOnce(created as never);

    const result = await createUserService('actor-1', { email: 'b@b.com', name: 'B', role: 'USUARIO' });
    expect(result.user).toEqual(created);
  });

  it('updateUserService lança quando usuário não existe', async () => {
    vi.mocked(findUserById).mockResolvedValueOnce(null);

    await expect(
      updateUserService('actor-1', 'missing-id', { name: 'X' })
    ).rejects.toThrow('Usuário não encontrado');
  });

  it('deleteUserService impede auto-exclusão', async () => {
    await expect(
      deleteUserService('user-1', 'user-1')
    ).rejects.toThrow('Não é possível excluir o próprio usuário');
  });
});
