import type { NotaExtraction } from '@ufly/shared';
import { findClientes } from '../models/cliente.model';
import type { Empresa } from '@ufly/shared';
import { extrairTextoPdf } from '../utils/pdf-texto';
import { numeroDoAmbiente } from '../utils/env';
import {
  brDateToISO,
  detectarTipo,
  lerDocumento,
  parseBRL,
  type CamposDocumento,
} from '../utils/documento-parser';

/**
 * Leitura automática de documentos financeiros (nota fiscal, boleto, fatura de
 * cartão e guia de imposto).
 *
 * A leitura é local: extrai a camada de texto do PDF e aplica as regras de
 * `utils/documento-parser`. Documento digitalizado (imagem) ou com senha não tem
 * texto para ler — nesses casos o arquivo é anexado e o usuário preenche à mão.
 *
 * O tipo do documento NÃO é pedido ao usuário: é identificado aqui. Antes havia
 * quatro botões de importação (nota fiscal, boleto, fatura, imposto) e a escolha
 * não se sustentava — uma fatura de cartão contém um boleto, e uma guia de imposto
 * também é paga por código de barras.
 */

export interface NotaFile {
  buffer: Buffer;
  mimetype: string;
  originalName: string;
}

const digits = (s: string): string => (s ?? '').replace(/\D/g, '');

const AVISO_LEITURA_LOCAL = 'Leitura automática — confira todos os campos.';

/**
 * Quanto tempo uma leitura pode ficar em andamento antes de ser considerada
 * interrompida (restart do backend no meio dela) e voltar para a fila.
 */
export function prazoDeLeituraMs(): number {
  return numeroDoAmbiente('LEITURA_PRAZO_MS', 30 * 60_000);
}

/**
 * Nota fiscal de serviço: parser dedicado, porque além de valor e data ele
 * resolve o cliente pelo CNPJ do tomador e separa os impostos retidos — coisas
 * que a leitura genérica não faz.
 */
async function lerNotaFiscal(texto: string): Promise<NotaExtraction> {
  const warnings: string[] = [AVISO_LEITURA_LOCAL];
  const metadata: Record<string, unknown> = {};

  const grab = (re: RegExp): string | undefined => re.exec(texto)?.[1]?.trim();

  // CNPJs: o 1º é o prestador (Ufly), o 2º é o tomador (cliente).
  const cnpjs = [...texto.matchAll(/CPF\/CNPJ:\s*([\d.\/-]{18})/g)].map((x) => x[1]);
  const cnpjTomador = cnpjs[1] ?? cnpjs[0];

  const amount = parseBRL(grab(/Valor Total da NFS-e\s*R\$\s*([\d.,]+)/));
  const dataEmissao = brDateToISO(grab(/Emitida em\s*(\d{2}\/\d{2}\/\d{4})/));
  const numero = grab(/(\d+\/\d{4})\s*Emitida em/);

  const impostos: Record<string, RegExp> = {
    iss: /Valor ISS\s*R\$\s*([\d.,]+)/,
    pis: /Valor PIS\s*R\$\s*([\d.,]+)/,
    cofins: /Valor COFINS\s*R\$\s*([\d.,]+)/,
    irpj: /Valor IR\s*R\$\s*([\d.,]+)/,
    inss: /Valor INSS\s*R\$\s*([\d.,]+)/,
    csll: /Valor CSLL\s*R\$\s*([\d.,]+)/,
  };
  for (const [key, re] of Object.entries(impostos)) {
    const v = parseBRL(grab(re));
    if (v !== undefined) metadata[key] = v;
  }

  if (numero) metadata.numero_nota = numero;
  if (dataEmissao) metadata.data_emissao = dataEmissao;

  // Resolve o cliente pelo CNPJ do tomador contra a base real.
  if (cnpjTomador) {
    metadata.cnpj = cnpjTomador;
    const alvo = digits(cnpjTomador);
    const clientes = await findClientes();
    let achou = false;
    for (const c of clientes) {
      const empresas = (c.empresas as unknown as Empresa[]) ?? [];
      const emp = empresas.find((e) => digits(e.cnpj ?? '') === alvo);
      if (emp) {
        metadata.cliente = c.id;
        metadata.empresa = emp.nome;
        achou = true;
        break;
      }
    }
    if (!achou) warnings.push(`Nenhum cliente cadastrado com o CNPJ ${cnpjTomador}.`);
  }

  if (amount === undefined) warnings.push('Valor da nota não identificado.');

  return {
    provider: 'local',
    tipoDetectado: 'nota_fiscal',
    confianca: 'media',
    categoriaSugerida: 'Serviços',
    tipoLancamentoSugerido: 'income',
    ...(amount !== undefined ? { amount } : {}),
    ...(dataEmissao ? { date: dataEmissao } : {}),
    metadata,
    warnings,
  };
}

/** Converte a leitura genérica para o formato que o frontend consome. */
function paraExtraction(campos: CamposDocumento): NotaExtraction {
  return {
    provider: 'local',
    tipoDetectado: campos.tipo,
    confianca: campos.confianca,
    tipoLancamentoSugerido: campos.tipoLancamentoSugerido,
    ...(campos.categoriaSugerida ? { categoriaSugerida: campos.categoriaSugerida } : {}),
    ...(campos.valor !== undefined ? { amount: campos.valor } : {}),
    ...(campos.data ? { date: campos.data } : {}),
    ...(campos.descricao ? { description: campos.descricao } : {}),
    metadata: campos.metadata,
    warnings: [AVISO_LEITURA_LOCAL, ...campos.warnings],
  };
}


/**
 * Ponto único de leitura de documento. Devolve os campos que deram para ler; o
 * usuário confere e edita antes de salvar. Nunca lança por documento ilegível —
 * o arquivo já foi anexado, e um formulário em branco com aviso é melhor que erro.
 */
export async function lerDocumentoFinanceiro(file: NotaFile): Promise<NotaExtraction> {
  const semLeitura: NotaExtraction = {
    provider: 'none',
    tipoDetectado: 'desconhecido',
    confianca: 'baixa',
    metadata: {},
    warnings: [],
  };

  if (file.mimetype !== 'application/pdf') {
    return {
      ...semLeitura,
      warnings: ['Imagem: a leitura automática exige OCR — o documento foi anexado; preencha os campos à mão.'],
    };
  }

  const { texto, falha } = await extrairTextoPdf(file.buffer);
  if (falha === 'protegido') {
    return {
      ...semLeitura,
      warnings: [
        'PDF protegido por senha — não foi possível ler o conteúdo. Anexe uma versão sem senha ou preencha os campos à mão.',
      ],
    };
  }
  if (falha === 'sem-texto') {
    return {
      ...semLeitura,
      warnings: [
        'Documento digitalizado (imagem, sem texto): a leitura automática exige OCR — preencha os campos à mão.',
      ],
    };
  }

  if (detectarTipo(texto).tipo === 'nota_fiscal') return lerNotaFiscal(texto);
  return paraExtraction(lerDocumento(texto));
}
