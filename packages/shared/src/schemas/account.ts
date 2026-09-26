import { z } from 'zod';

export const AccountTypeEnum = z.enum(['bank', 'credit_card', 'wallet']);
export type AccountType = z.infer<typeof AccountTypeEnum>;

export const AccountSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1).max(100),
  type: AccountTypeEnum,
  balance: z.number().nonnegative(),
  currency: z.string().default('BRL'),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const AccountCreateSchema = z.object({
  name: z.string().min(1).max(100),
  type: AccountTypeEnum,
  balance: z.number().nonnegative().default(0),
});

export const AccountUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  balance: z.number().nonnegative().optional(),
});

export type Account = z.infer<typeof AccountSchema>;
export type AccountCreate = z.infer<typeof AccountCreateSchema>;
export type AccountUpdate = z.infer<typeof AccountUpdateSchema>;
