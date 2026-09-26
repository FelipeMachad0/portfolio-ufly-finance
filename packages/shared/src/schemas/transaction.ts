import { z } from 'zod';

export const TransactionTypeEnum = z.enum(['income', 'expense', 'transfer']);
export const TransactionStatusEnum = z.enum(['pending', 'completed', 'cancelled']);

export type TransactionType = z.infer<typeof TransactionTypeEnum>;
export type TransactionStatus = z.infer<typeof TransactionStatusEnum>;

/**
 * Valores dos campos dinâmicos definidos em `category.fieldsSchema`.
 * Chaves correspondem a `CategoryField.key`. A tipagem real depende do
 * `FieldType` declarado na categoria; aqui aceitamos `unknown` para preservar
 * flexibilidade — a validação por categoria é feita em camada superior.
 */
export const TransactionMetadataSchema = z.record(z.string(), z.unknown());
export type TransactionMetadata = z.infer<typeof TransactionMetadataSchema>;

export const TransactionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  accountId: z.string().uuid(),
  categoryId: z.string().uuid().nullable(),
  amount: z.number().positive(),
  type: TransactionTypeEnum,
  description: z.string().max(500),
  date: z.date(),
  status: TransactionStatusEnum,
  metadata: TransactionMetadataSchema.default({}),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const TransactionCreateSchema = z.object({
  accountId: z.string().uuid(),
  categoryId: z.string().uuid().nullable().optional(),
  amount: z.number().positive('Valor deve ser positivo'),
  type: TransactionTypeEnum,
  description: z.string().min(1).max(500),
  date: z.coerce.date(),
  status: TransactionStatusEnum.default('completed'),
  metadata: TransactionMetadataSchema.optional(),
});

export const TransactionUpdateSchema = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  amount: z.number().positive().optional(),
  description: z.string().min(1).max(500).optional(),
  date: z.coerce.date().optional(),
  status: TransactionStatusEnum.optional(),
  metadata: TransactionMetadataSchema.optional(),
});

export type Transaction = z.infer<typeof TransactionSchema>;
export type TransactionCreate = z.infer<typeof TransactionCreateSchema>;
export type TransactionUpdate = z.infer<typeof TransactionUpdateSchema>;
