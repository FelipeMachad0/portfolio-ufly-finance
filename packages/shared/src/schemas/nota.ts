import { z } from 'zod';
import { ConfiancaSchema, DocumentoTipoSchema } from './documento';

/** Referência de um arquivo armazenado (nota fiscal / comprovante anexado). */
export const NotaRefSchema = z.object({
  id: z.string(),
  originalName: z.string(),
  mimetype: z.string(),
  size: z.number(),
});
export type NotaRef = z.infer<typeof NotaRefSchema>;

/**
 * Resultado da leitura automática de um documento. Tudo aqui é SUGESTÃO
 * para pré-preencher o formulário — o usuário revisa e edita antes de salvar.
 * `metadata` usa as mesmas keys dos campos dinâmicos do tipo/categoria.
 */
export const NotaExtractionSchema = z.object({
  /** Natureza identificada na leitura. Contexto para o usuário, não decisão final. */
  tipoDetectado: DocumentoTipoSchema.default('desconhecido'),
  /** Quão segura foi a identificação — a interface gradua o aviso por isto. */
  confianca: ConfiancaSchema.default('baixa'),
  /**
   * Nome da categoria do app sugerida (ex.: "Impostos", "Terceiros"). É o que
   * realmente importa: a taxonomia do app é a das categorias, não a natureza do
   * documento.
   */
  categoriaSugerida: z.string().optional(),
  /** Tipo de lançamento sugerido; o usuário pode trocar no formulário. */
  tipoLancamentoSugerido: z.enum(['income', 'expense']).optional(),
  /** Valor sugerido do lançamento (R$). */
  amount: z.number().positive().optional(),
  /** Descrição de topo do lançamento (resumo). */
  description: z.string().optional(),
  /** Data do lançamento (YYYY-MM-DD), normalmente a data de emissão. */
  date: z.string().optional(),
  /** Nome de categoria sugerido (opcional; o usuário confirma). */
  categoryHint: z.string().optional(),
  /** Valores para os campos dinâmicos, indexados por CategoryField.key. */
  metadata: z.record(z.string(), z.unknown()).default({}),
  /** Avisos para o usuário (ex.: CNPJ não corresponde a cliente cadastrado). */
  warnings: z.array(z.string()).default([]),
  /** Origem da extração: leitura local do PDF, ou nenhuma (documento sem texto). */
  provider: z.enum(['local', 'none']),
});
export type NotaExtraction = z.infer<typeof NotaExtractionSchema>;

/**
 * Retorno do endpoint de importação: o documento anexado + a extração automática.
 *
 * Não há mais `tipo` de entrada: o usuário só escolhe o arquivo, e a natureza do
 * documento sai em `extraction.tipoDetectado`.
 */
export const NotaImportResultSchema = z.object({
  nota: NotaRefSchema,
  extraction: NotaExtractionSchema,
});
export type NotaImportResult = z.infer<typeof NotaImportResultSchema>;
