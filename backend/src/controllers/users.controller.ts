import type { Request, Response } from 'express';
import { UserCreateSchema, UserUpdateSchema, UserRoleEnum, UserStatusEnum } from '@ufly/shared';
import {
  listUsers,
  getUser,
  createUserService,
  updateUserService,
  deleteUserService,
} from '../services/user.service';
import type { User } from '../models/user.model';

/** Remove password_hash de qualquer payload de usuário antes de devolver via API. */
function sanitize<T extends Partial<User>>(u: T): Omit<T, 'password_hash'> {
  const copy = { ...u } as Record<string, unknown>;
  delete copy['password_hash'];
  return copy as Omit<T, 'password_hash'>;
}

export async function index(req: Request, res: Response): Promise<void> {
  try {
    const role = req.query['role'];
    const status = req.query['status'];
    const search = req.query['search'];

    const roleParse = role ? UserRoleEnum.safeParse(role) : null;
    const statusParse = status ? UserStatusEnum.safeParse(status) : null;

    const users = await listUsers({
      role: roleParse?.success ? roleParse.data : undefined,
      status: statusParse?.success ? statusParse.data : undefined,
      search: typeof search === 'string' ? search : undefined,
    });
    res.json(users.map(sanitize));
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function show(req: Request, res: Response): Promise<void> {
  try {
    const user = await getUser(req.params['id'] as string);
    res.json(sanitize(user));
  } catch (err) {
    res.status(404).json({ error: (err as Error).message });
  }
}

/**
 * Mensagem apresentável ao usuário.
 *
 * Erros do Prisma vazavam crus para a tela — o cadastro mostrava "Invalid
 * `prisma.user.create()` invocation: Unique constraint failed on the fields:
 * (`email`)". Além de incompreensível para quem usa, expõe detalhe interno de
 * como o dado é guardado.
 */
function mensagemDeErro(err: unknown): string {
  const msg = (err as Error)?.message ?? '';
  if (/Unique constraint failed/i.test(msg) && /email/i.test(msg)) {
    return 'Este e-mail já está cadastrado.';
  }
  if (/prisma\.|invocation:/i.test(msg)) {
    return 'Não foi possível salvar. Confira os dados e tente novamente.';
  }
  return msg || 'Não foi possível salvar.';
}

export async function create(req: Request, res: Response): Promise<void> {
  const parsed = UserCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.flatten() });
    return;
  }
  try {
    const { user } = await createUserService(req.userId!, parsed.data);
    const safeUser = { ...user } as Record<string, unknown>;
    delete safeUser['password_hash'];
    res.status(201).json(safeUser);
  } catch (err) {
    res.status(400).json({ error: mensagemDeErro(err) });
  }
}

export async function update(req: Request, res: Response): Promise<void> {
  const parsed = UserUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.flatten() });
    return;
  }
  try {
    const user = await updateUserService(req.userId!, req.params['id'] as string, parsed.data);
    res.json(sanitize(user));
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}

export async function remove(req: Request, res: Response): Promise<void> {
  try {
    await deleteUserService(req.userId!, req.params['id'] as string);
    res.json({ message: 'Usuário removido' });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}

export async function me(req: Request, res: Response): Promise<void> {
  try {
    const user = await getUser(req.userId!);
    res.json(sanitize(user));
  } catch (err) {
    res.status(404).json({ error: (err as Error).message });
  }
}
