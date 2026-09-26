import { z } from 'zod';

export const CategoryTypeEnum = z.enum(['income', 'expense']);
export type CategoryType = z.infer<typeof CategoryTypeEnum>;

// ─── Schema dinâmico de campos por categoria ─────────────────────────────────

/**
 * Tipos de campo suportados em `CategoryField`.
 *
 * - `date`     — input type=date, valor serializado como ISO YYYY-MM-DD
 * - `string`   — input type=text de uma linha
 * - `textarea` — área de texto multilinhas
 * - `number`   — número inteiro/decimal genérico
 * - `currency` — número em BRL com 2 casas (exibido como R$)
 * - `select`   — dropdown com `options` (array de strings)
 * - `boolean`  — checkbox / yes-no
 */
export const FieldTypeEnum = z.enum([
  'date',
  'string',
  'textarea',
  'number',
  'currency',
  'select',
  'boolean',
  // Campos vinculados (selects dinâmicos com cascata no formulário)
  'cliente',  // select de clientes
  'empresa',  // select das empresas do cliente selecionado
  'cnpj',     // CNPJ preenchido automaticamente a partir da empresa
  'projeto',  // select dos projetos do cliente selecionado
]);
export type FieldType = z.infer<typeof FieldTypeEnum>;

/**
 * Definição de um campo dinâmico de categoria. A `key` identifica o campo
 * dentro de `transactions.metadata`; o `label` é o nome de exibição.
 */
export const CategoryFieldSchema = z.object({
  /** Identificador snake_case usado como chave em `transactions.metadata`. */
  key: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z][a-z0-9_]*$/, 'Use snake_case (letras minúsculas, números e _)'),
  /** Nome exibido no formulário e no cabeçalho da tabela. */
  label: z.string().min(1).max(80),
  type: FieldTypeEnum,
  /** Se verdadeiro, o campo é obrigatório no formulário. */
  required: z.boolean().optional().default(false),
  /** Opções do dropdown, apenas para `type === 'select'`. */
  options: z.array(z.string().min(1)).optional(),
});
export type CategoryField = z.infer<typeof CategoryFieldSchema>;

/** Array de campos — usado para validar schemas de campos (categoria/tipo). */
export const CategoryFieldsArraySchema = z.array(CategoryFieldSchema);

// ─── Category ────────────────────────────────────────────────────────────────

export const CategorySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1).max(50),
  type: CategoryTypeEnum,
  color: z.string().regex(/^#[0-9A-F]{6}$/i),
  icon: z.string().optional(),
  /** Lista ordenada de campos dinâmicos. Default `[]`. */
  fieldsSchema: z.array(CategoryFieldSchema).default([]),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CategoryCreateSchema = z.object({
  name: z.string().min(1).max(50),
  type: CategoryTypeEnum,
  color: z.string().regex(/^#[0-9A-F]{6}$/i),
  icon: z.string().optional(),
  fieldsSchema: z.array(CategoryFieldSchema).optional(),
});

export const CategoryUpdateSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  icon: z.string().optional(),
  fieldsSchema: z.array(CategoryFieldSchema).optional(),
});

export type Category = z.infer<typeof CategorySchema>;
export type CategoryCreate = z.infer<typeof CategoryCreateSchema>;
export type CategoryUpdate = z.infer<typeof CategoryUpdateSchema>;
