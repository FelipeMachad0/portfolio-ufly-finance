import api from './api';
import type { NotaImportResult } from '@ufly/shared';

/**
 * Envia o documento (PDF/imagem) para leitura automática. Devolve a referência do anexo +
 * os campos extraídos para pré-preencher o formulário; o usuário revisa e edita
 * antes de salvar o lançamento.
 *
 * Não informa o tipo do documento: quem identifica é a leitura. Antes o usuário
 * escolhia entre nota fiscal, boleto, fatura e imposto — a escolha não se
 * sustentava (uma fatura de cartão contém um boleto) e não servia para nada
 * depois, porque a taxonomia do app é a das categorias.
 */
export async function importarDocumento(file: File): Promise<NotaImportResult> {
  const form = new FormData();
  form.append('file', file);
  const res = await api.post<NotaImportResult>('/notas/importar', form);
  return res.data;
}
