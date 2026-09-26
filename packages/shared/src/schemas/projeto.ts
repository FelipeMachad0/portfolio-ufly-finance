import { z } from 'zod';

/** Referência do arquivo do contrato (mesmo formato da nota anexa). */
export const ContratoRefSchema = z.object({
  id: z.string(),
  originalName: z.string(),
  mimetype: z.string(),
  size: z.number(),
});
export type ContratoRef = z.infer<typeof ContratoRefSchema>;

/** Item do contrato do projeto (pode haver vários). */
export const ProjetoItemSchema = z.object({
  descricao: z.string().min(1).max(500),
  categoria: z.string().max(255).optional().default(''),
  prazoPagamento: z.string().max(100).optional().default(''),
  inicioContrato: z.string().nullable().optional(), // YYYY-MM-DD
  fimContrato: z.string().nullable().optional(),
  vendedor: z.string().max(255).optional().default(''),
  comissaoPct: z.number().min(0).max(100).optional().default(0),
});
export type ProjetoItem = z.infer<typeof ProjetoItemSchema>;

export const ProjetoCreateSchema = z.object({
  clienteId: z.string().uuid(),
  nome: z.string().min(1).max(255),
  descricao: z.string().nullable().optional(),
  contrato: ContratoRefSchema.nullable().optional(),
  inicioMaster: z.coerce.date().nullable().optional(),
  fimMaster: z.coerce.date().nullable().optional(),
  itens: z.array(ProjetoItemSchema).default([]),
});

export const ProjetoUpdateSchema = ProjetoCreateSchema.partial();

export type ProjetoCreate = z.infer<typeof ProjetoCreateSchema>;
export type ProjetoUpdate = z.infer<typeof ProjetoUpdateSchema>;
