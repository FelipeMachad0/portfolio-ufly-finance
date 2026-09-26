import { z } from 'zod';

export const UserRoleEnum = z.enum(['USUARIO', 'GESTOR_DEPARTAMENTO', 'GESTOR_GERAL', 'AUDITOR']);
export type UserRole = z.infer<typeof UserRoleEnum>;

export const UserStatusEnum = z.enum(['ATIVO', 'INATIVO']);
export type UserStatus = z.infer<typeof UserStatusEnum>;

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1).max(255),
  role: UserRoleEnum,
  status: UserStatusEnum,
  entraId: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  lastLogin: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const UserCreateSchema = z.object({
  email: z.string().email('Email inválido'),
  name: z.string().min(1, 'Nome obrigatório').max(255),
  role: UserRoleEnum.default('USUARIO'),
});

export const UserUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  role: UserRoleEnum.optional(),
  status: UserStatusEnum.optional(),
});

export type User = z.infer<typeof UserSchema>;
export type UserCreate = z.infer<typeof UserCreateSchema>;
export type UserUpdate = z.infer<typeof UserUpdateSchema>;
