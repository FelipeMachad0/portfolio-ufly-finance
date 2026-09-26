import { z } from 'zod';

/** Empresa de um cliente (um cliente pode ter várias). */
export const EmpresaSchema = z.object({
  nome: z.string().min(1).max(255),
  cnpj: z.string().max(20).optional().default(''),
});
export type Empresa = z.infer<typeof EmpresaSchema>;

export const ClienteSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  nome: z.string(),
  empresas: z.array(EmpresaSchema),
  createdAt: z.date().nullable(),
  updatedAt: z.date().nullable(),
});

export const ClienteCreateSchema = z.object({
  nome: z.string().min(1).max(255),
  empresas: z.array(EmpresaSchema).default([]),
});

export const ClienteUpdateSchema = z.object({
  nome: z.string().min(1).max(255).optional(),
  empresas: z.array(EmpresaSchema).optional(),
});

export type Cliente = z.infer<typeof ClienteSchema>;
export type ClienteCreate = z.infer<typeof ClienteCreateSchema>;
export type ClienteUpdate = z.infer<typeof ClienteUpdateSchema>;
