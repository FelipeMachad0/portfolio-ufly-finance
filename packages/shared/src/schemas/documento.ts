import { z } from 'zod';

/**
 * Naturezas de documento que a leitura identifica. É SAÍDA da extração, não escolha
 * do usuário.
 *
 * O usuário escolhia o tipo antes de importar, em quatro botões. Trocamos por um
 * botão só porque a classificação não se sustenta:
 *
 *  - "boleto" é meio de pagamento, não natureza de documento. Uma fatura de
 *    cartão CONTÉM um boleto; uma guia de imposto também é paga por código de
 *    barras. Testando marcadores nos documentos reais, o mesmo arquivo casava
 *    como boleto e como fatura ao mesmo tempo.
 *  - a escolha não servia para nada depois: a taxonomia do app é a das
 *    categorias (Impostos, Terceiros, Sócios, Outros Gastos, Empréstimos), e os
 *    quatro botões não mapeavam nela.
 *
 * Por isso o que importa de verdade é `categoriaSugerida`; o tipo detectado vale
 * como contexto para o usuário conferir.
 */
export const DOCUMENTO_TIPOS = [
  'nota_fiscal',
  'boleto',
  'fatura_cartao',
  'imposto',
  'desconhecido',
] as const;

export const DocumentoTipoSchema = z.enum(DOCUMENTO_TIPOS);
export type DocumentoTipo = z.infer<typeof DocumentoTipoSchema>;

export interface DocumentoTipoMeta {
  label: string;
  /**
   * Tipo de lançamento sugerido ao abrir o formulário. É só uma sugestão: quem
   * decide de fato é a categoria escolhida pelo usuário, que pode trocar entre
   * Entrada e Saída no próprio formulário.
   */
  tipoSugerido: 'income' | 'expense';
}

export const DOCUMENTO_TIPO_META: Record<DocumentoTipo, DocumentoTipoMeta> = {
  nota_fiscal: { label: 'Nota fiscal', tipoSugerido: 'income' },
  boleto: { label: 'Boleto', tipoSugerido: 'expense' },
  fatura_cartao: { label: 'Fatura de cartão', tipoSugerido: 'expense' },
  imposto: { label: 'Documento de imposto', tipoSugerido: 'expense' },
  // Não identificado: a maioria dos documentos importados é despesa, e o
  // usuário confirma antes de salvar.
  desconhecido: { label: 'Documento', tipoSugerido: 'expense' },
};

/** Confiança da leitura na identificação, para a interface graduar o aviso. */
export const ConfiancaSchema = z.enum(['alta', 'media', 'baixa']);
export type Confianca = z.infer<typeof ConfiancaSchema>;
