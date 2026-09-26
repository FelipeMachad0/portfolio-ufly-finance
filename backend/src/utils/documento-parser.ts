/**
 * Identificação e leitura de campos de documentos financeiros (boleto, fatura de
 * cartão, guia de imposto, nota fiscal).
 *
 * Funções puras: recebem o texto do PDF e devolvem os campos — assim dá para
 * testar contra os fixtures sem subir banco nem servidor.
 *
 * Escrito a partir de uma amostra de 14 documentos reais. Cada regra abaixo
 * existe porque casou (ou falhou) em algum deles; o teste
 * `documento-parser.test.ts` fixa esses acertos, sobre versões anonimizadas.
 */
import { DOCUMENTO_TIPO_META, type Confianca, type DocumentoTipo } from '@ufly/shared';

/** "11.200,00" → 11200.00 */
export function parseBRL(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const limpo = s.trim().replace(/\./g, '').replace(',', '.');
  const n = Number(limpo);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** "18/03/2026" → "2026-03-18" */
export function brDateToISO(s: string | undefined): string | undefined {
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(s ?? '');
  return m ? `${m[3]}-${m[2]}-${m[1]}` : undefined;
}

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

/**
 * "15 de julho" → ISO. As faturas de cartão escrevem o vencimento sem o ano
 * (C6 e Cora, os dois emissores da amostra), então o ano é inferido: assume-se a
 * ocorrência mais próxima de `hoje`, para frente ou para trás.
 */
export function dataPorExtensoISO(dia: number, mesNome: string, hoje: Date): string | undefined {
  const mes = MESES.indexOf(mesNome.toLowerCase());
  if (mes < 0 || dia < 1 || dia > 31) return undefined;
  const candidatos = [hoje.getUTCFullYear() - 1, hoje.getUTCFullYear(), hoje.getUTCFullYear() + 1];
  let melhor = '';
  let menorDistancia = Infinity;
  for (const ano of candidatos) {
    const d = Date.UTC(ano, mes, dia);
    const dist = Math.abs(d - hoje.getTime());
    if (dist < menorDistancia) {
      menorDistancia = dist;
      melhor = new Date(d).toISOString().slice(0, 10);
    }
  }
  return melhor || undefined;
}

// ── Código de barras do boleto ──────────────────────────────────────────────
//
// A linha digitável é a fonte mais confiável de valor e vencimento: vem do
// banco, não do desenho da página. Os rótulos ("Valor do Documento") saem do
// pdf.js em ordem imprevisível — às vezes o número vem antes do rótulo, às vezes
// depois — e num boleto há vários valores parecidos (multa, desconto, mora).
//
// Formato (47 dígitos, 5 campos impressos):
//   AAABC.CCCCX  DDDDD.DDDDDY  EEEEE.EEEEEZ  K  UUUUVVVVVVVVVV
// O último campo são 14 dígitos: fator de vencimento (4) + valor em centavos (10).

const LINHA_DIGITAVEL =
  /\d{5}[.\s]?\d{5}\s+\d{5}[.\s]?\d{6}\s+\d{5}[.\s]?\d{6}\s+\d\s+(\d{4})(\d{10})/;

/**
 * Fator de vencimento → data. A referência é 07/10/1997 (fator 1000 = 03/07/2000).
 * O contador ia até 9999 (21/02/2025) e reiniciou em 1000 no dia seguinte, então
 * o mesmo fator serve duas datas ~24,6 anos distantes: escolhemos a mais próxima
 * de `hoje`.
 */
export function fatorVencimentoISO(fator: number, hoje: Date): string | undefined {
  if (fator <= 0) return undefined;
  const BASE = Date.UTC(1997, 9, 7);
  const DIA = 86_400_000;
  const CICLO = 9000; // 9999 - 1000 + 1
  let melhor: string | undefined;
  let menorDistancia = Infinity;
  for (const ciclo of [0, 1, 2]) {
    const d = BASE + (fator + ciclo * CICLO) * DIA;
    const dist = Math.abs(d - hoje.getTime());
    if (dist < menorDistancia) {
      menorDistancia = dist;
      melhor = new Date(d).toISOString().slice(0, 10);
    }
  }
  return melhor;
}

export interface DadosCodigoBarras {
  valor?: number;
  vencimento?: string;
}

export function lerCodigoBarras(texto: string, hoje: Date): DadosCodigoBarras | undefined {
  const m = LINHA_DIGITAVEL.exec(texto);
  if (!m) return undefined;
  const fator = Number(m[1]);
  const centavos = Number(m[2]);
  const out: DadosCodigoBarras = {};
  // Valor zerado é legítimo em boleto de valor livre (tributo, doação).
  if (centavos > 0) out.valor = centavos / 100;
  const venc = fatorVencimentoISO(fator, hoje);
  if (venc) out.vencimento = venc;
  return Object.keys(out).length ? out : undefined;
}

// ── Identificação do tipo ───────────────────────────────────────────────────

interface RegraDeTipo {
  tipo: DocumentoTipo;
  padroes: RegExp[];
  /** Quantos padrões precisam casar para o tipo ser aceito. */
  minimo: number;
}

/**
 * Regras em ORDEM DE PRIORIDADE — e a ordem é o ponto central.
 *
 * Nos documentos reais o mesmo arquivo casa com vários tipos: uma fatura de
 * cartão CONTÉM um boleto (a do C6 traz linha digitável e "boleto" escrito), e
 * uma guia de imposto também é paga por código de barras. Então "boleto" fica
 * por último, como sobra: é boleto o que não é imposto, fatura nem nota fiscal.
 */
const REGRAS: RegraDeTipo[] = [
  {
    tipo: 'nota_fiscal',
    padroes: [
      /nfs-?e/i,
      /nota fiscal de servi/i,
      /prestador/i,
      /tomador/i,
      /valor total da nfs/i,
      /discrimina[çc][ãa]o dos servi/i,
    ],
    minimo: 2,
  },
  {
    tipo: 'imposto',
    padroes: [
      /documento de arrecada[çc][ãa]o/i,
      /receita federal/i,
      /\bdarf\b/i,
      /minist[eé]rio da fazenda/i,
      /c[oó]digo (?:da )?receita/i,
      /per[ií]odo de apura[çc][ãa]o/i,
      /simples nacional/i,
      /prefeitura/i,
      /\biss\b/i,
      /guia de recolhimento/i,
    ],
    minimo: 2,
  },
  {
    tipo: 'fatura_cartao',
    padroes: [
      /limite total/i,
      /limite dispon[ií]vel/i,
      /pagamento m[ií]nimo/i,
      /melhor dia de compra/i,
      /valor da fatura/i,
      /sua fatura/i,
      /fatura de\s+\w+, no valor/i,
      /rotativo/i,
      /cart[ãa]o de cr[eé]dito/i,
      /compras internacionais/i,
    ],
    minimo: 3,
  },
  {
    tipo: 'boleto',
    padroes: [
      /nosso n[uú]mero/i,
      /benefici[aá]rio/i,
      /linha digit[aá]vel/i,
      /recibo do pagador/i,
      /ficha de compensa[çc][ãa]o/i,
      /pag[aá]vel\b/i,
      /ag[eê]ncia\s*\/\s*c[oó]d/i,
      /esp[eé]cie doc/i,
      /\bcedente\b/i,
    ],
    minimo: 2,
  },
];

export interface Deteccao {
  tipo: DocumentoTipo;
  confianca: Confianca;
}

export function detectarTipo(texto: string): Deteccao {
  for (const regra of REGRAS) {
    const acertos = regra.padroes.filter((pat) => pat.test(texto)).length;
    if (acertos >= regra.minimo) {
      // Metade ou mais dos marcadores é sinal forte; no mínimo exigido, médio.
      return {
        tipo: regra.tipo,
        confianca: acertos >= Math.ceil(regra.padroes.length / 2) ? 'alta' : 'media',
      };
    }
  }
  return { tipo: 'desconhecido', confianca: 'baixa' };
}

// ── Leitura de campos ───────────────────────────────────────────────────────

/**
 * Procura o valor perto de um rótulo, nas duas direções. A ordem do texto que o
 * pdf.js devolve segue a posição na página, e em boleto o número costuma cair
 * antes do rótulo (as caixas do formulário são desenhadas primeiro).
 */
function valorPertoDeRotulo(texto: string, rotulo: RegExp): number | undefined {
  const fonte = rotulo.source;
  const depois = new RegExp(`${fonte}[^\\d]{0,40}([\\d.]+,\\d{2})`, 'i').exec(texto);
  const v1 = parseBRL(depois?.[1]);
  if (v1 !== undefined) return v1;
  const antes = new RegExp(`([\\d.]+,\\d{2})[^\\d]{0,40}${fonte}`, 'i').exec(texto);
  return parseBRL(antes?.[1]);
}

function dataPertoDeRotulo(texto: string, rotulo: RegExp): string | undefined {
  const fonte = rotulo.source;
  const depois = new RegExp(`${fonte}[^\\d]{0,30}(\\d{2}/\\d{2}/\\d{4})`, 'i').exec(texto);
  if (depois) return brDateToISO(depois[1]);
  const antes = new RegExp(`(\\d{2}/\\d{2}/\\d{4})[^\\d]{0,30}${fonte}`, 'i').exec(texto);
  return antes ? brDateToISO(antes[1]) : undefined;
}

export interface CamposDocumento {
  tipo: DocumentoTipo;
  confianca: Confianca;
  tipoLancamentoSugerido: 'income' | 'expense';
  categoriaSugerida?: string;
  valor?: number;
  data?: string;
  descricao?: string;
  metadata: Record<string, unknown>;
  warnings: string[];
}

const CNPJ = /(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/g;

/** CNPJ da Ufly (prestador/pagador): não é o fornecedor, é a gente. */
const CNPJ_UFLY = /^41\.287\.365\//;

function cnpjDoFornecedor(texto: string): string | undefined {
  const todos = [...texto.matchAll(CNPJ)].map((m) => m[1]);
  return todos.find((c) => !CNPJ_UFLY.test(c));
}

function primeiroGrupo(texto: string, re: RegExp): string | undefined {
  return re.exec(texto)?.[1]?.trim() || undefined;
}

/**
 * Razão social do fornecedor, achada pelo sufixo societário.
 *
 * Buscar pelo rótulo "Beneficiário" não funciona: nos boletos reais o pdf.js
 * devolve o bloco de rótulos inteiro antes dos valores, então o vizinho do
 * rótulo é outro rótulo ("RECIBO DO PAGADOR Beneficiário CNPJ..."). O sufixo
 * LTDA/S.A. é um âncora bem mais confiável.
 *
 * A Ufly aparece nesses documentos como pagadora — nunca é o fornecedor.
 */
function razaoSocial(texto: string): string | undefined {
  const re = /\b([A-ZÀ-Ú][A-ZÀ-Ú0-9&.\-/ ]{4,58}?(?:LTDA|EIRELI|S\/A|S\.A\.|MEI)\b\.?)/g;
  for (const m of texto.matchAll(re)) {
    const nome = m[1].replace(/\s{2,}/g, ' ').trim();
    if (/UFLY/i.test(nome)) continue;
    // Um boleto cita outras empresas além de quem recebe: o boleto de condomínio
    // da amostra nomeia o inquilino da unidade, que tem "LTDA" no nome e vinha
    // sendo confundido com o beneficiário.
    const antes = texto.slice(Math.max(0, (m.index ?? 0) - 24), m.index ?? 0);
    if (/(?:Inquilino|Propriet[áa]rio|Pagador|Sacado|Locat[áa]rio)\s*:?\s*\S*\s*$/i.test(antes)) {
      continue;
    }
    return nome;
  }
  return undefined;
}

/** Rótulos do formulário do boleto — nunca são nome de empresa. */
const ROTULOS_BOLETO =
  /recibo do pagador|ficha de (?:compensa|caixa)|local de pagamento|nosso n[uú]mero|autentica[çc][ãa]o|benefici[aá]rio final|uso do banco/i;

/**
 * Linha de valores do DARF em formulário:
 * "<código> <vencimento> <principal> <multa> <total>".
 * Grupos: 1 = vencimento, 2 = principal, 3 = multa/encargos, 4 = total.
 */
function linhaDeValoresDarf(texto: string): RegExpExecArray | null {
  return /\d{4}\s+(\d{2}\/\d{2}\/\d{4})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})/.exec(
    texto
  );
}

/** Guia de imposto (DARF, DAS, ISS municipal). */
function lerImposto(texto: string, hoje: Date): Partial<CamposDocumento> {
  const metadata: Record<string, unknown> = {};
  const warnings: string[] = [];

  let valor =
    valorPertoDeRotulo(texto, /Valor Total do Documento/) ??
    valorPertoDeRotulo(texto, /Valor:/) ??
    valorPertoDeRotulo(texto, /Valor Total/);

  // DARF em formulário (o de parcelamento): principal + multa + total na mesma
  // linha, sem rótulo por perto. O total é o último.
  if (valor === undefined) valor = parseBRL(linhaDeValoresDarf(texto)?.[4]);

  let data =
    dataPertoDeRotulo(texto, /Pagar este documento at[eé]/) ??
    dataPertoDeRotulo(texto, /Pagar at[eé]:?/) ??
    dataPertoDeRotulo(texto, /Data de Vencimento/) ??
    dataPertoDeRotulo(texto, /Data limite para acolhimento/) ??
    dataPertoDeRotulo(texto, /Vencimento:?/);

  // No DARF em formulário os rótulos vêm todos juntos e os valores depois, então
  // nenhum rótulo fica perto da data. Aí a data é a que abre a linha de valores.
  if (!data) data = brDateToISO(linhaDeValoresDarf(texto)?.[1]);

  // Órgão arrecadador: define o "Fornecedor / Órgão" da categoria Impostos.
  // "Documento de Arrecadação de Receitas Federais" (plural) é o título do DARF;
  // "Receita Federal" no singular aparece só em alguns modelos.
  const orgao = /receitas? federa(?:l|is)|minist[eé]rio da fazenda/i.test(texto)
    ? 'Receita Federal'
    : primeiroGrupo(texto, /(Prefeitura[^\n]{0,40}?)(?:\s{2,}|\n)/i);
  if (orgao) metadata.fornecedor_orgao = orgao;

  // Tipo de imposto: casa com as opções do campo select da categoria Impostos.
  const tributos = ['COFINS', 'PIS', 'IRPJ', 'CSLL', 'INSS', 'ISS', 'ICMS', 'IPI'] as const;
  const achados = tributos.filter((t) => new RegExp(`\\b${t}\\b`).test(texto));
  if (achados.length === 1) metadata.tipo_imposto = achados[0];
  else if (achados.length > 1) {
    // PIS/Cofins na mesma guia é o caso comum e costuma ser lançado como uma
    // linha só, então não escolhemos um tributo.
    metadata.observacao = `Tributos na guia: ${achados.join(', ')}`;
  } else if (/contrib\s+previdenci|\bcp\b\s+segurados/i.test(texto)) {
    metadata.tipo_imposto = 'INSS';
  }

  const competencia = primeiroGrupo(texto, /PA:\s*(\d{2}\/\d{4})/);
  if (competencia) {
    const [mes, ano] = competencia.split('/');
    metadata.competencia = `${ano}-${mes}-01`;
  }

  const numero = primeiroGrupo(texto, /(\d{2}\.\d{2}\.\d{5}\.\d{7}-\d)/);
  if (numero) metadata.numero_documento = numero;

  if (data) metadata.data = data;
  if (valor !== undefined) metadata.valor = valor;

  const partes = ['Imposto'];
  if (metadata.tipo_imposto) partes.push(String(metadata.tipo_imposto));
  if (competencia) partes.push(`competência ${competencia}`);

  return {
    categoriaSugerida: 'Impostos',
    ...(valor !== undefined ? { valor } : {}),
    ...(data ? { data } : {}),
    descricao: partes.join(' — '),
    metadata,
    warnings,
  };
}

/** Fatura de cartão de crédito. */
function lerFaturaCartao(texto: string, hoje: Date): Partial<CamposDocumento> {
  const metadata: Record<string, unknown> = {};
  const warnings: string[] = [];

  // "Pagamento total" é o rótulo certo. NÃO usar "Pagamento mínimo" nem as
  // opções de parcelamento — pagar o mínimo não zera a fatura, e lançar o mínimo
  // como despesa registraria menos do que se deve.
  const valor =
    parseBRL(primeiroGrupo(texto, /no valor de\s*R\$\s*([\d.]+,\d{2})/i)) ??
    parseBRL(primeiroGrupo(texto, /Valor da fatura:?\s*R\$\s*([\d.]+,\d{2})/i)) ??
    parseBRL(primeiroGrupo(texto, /Pagamento total\s*(?:Recomendado)?\s*R\$\s*([\d.]+,\d{2})/i));

  // Vencimento sem ano: "Vencimento: 15 de julho".
  let data = dataPertoDeRotulo(texto, /Vencimento:?/);
  if (!data) {
    const ext = /(?:Data do vencimento|Vencimento):?\s*(\d{1,2})\s+de\s+([A-Za-zÀ-ú]+)/i.exec(texto);
    if (ext) {
      data = dataPorExtensoISO(Number(ext[1]), ext[2], hoje);
      if (data) warnings.push(`Vencimento no documento não traz o ano; assumido ${data}.`);
    }
  }

  const emissor = primeiroGrupo(texto, /(C6 Bank|Cora Sociedade de Cr[eé]dito Direto[^.]*)/i);
  if (emissor) metadata.fornecedor = emissor.replace(/\s+S\/A\.?$/i, '').trim();

  const cnpj = cnpjDoFornecedor(texto);
  if (cnpj) metadata.cnpj = cnpj;
  if (data) metadata.data = data;
  if (valor !== undefined) metadata.valor = valor;

  const mes = primeiroGrupo(texto, /fatura de\s+([A-Za-zÀ-ú]+)/i) ?? primeiroGrupo(texto, /vencimento em\s+([A-Za-zÀ-ú]+)/i);
  metadata.descricao = `Fatura de cartão${emissor ? ` — ${metadata.fornecedor}` : ''}${mes ? ` (${mes})` : ''}`;

  return {
    categoriaSugerida: 'Outros Gastos',
    ...(valor !== undefined ? { valor } : {}),
    ...(data ? { data } : {}),
    descricao: String(metadata.descricao),
    metadata,
    warnings,
  };
}

/** Boleto de cobrança. */
function lerBoleto(texto: string, hoje: Date): Partial<CamposDocumento> {
  const metadata: Record<string, unknown> = {};
  const warnings: string[] = [];

  const barras = lerCodigoBarras(texto, hoje);

  const valorRotulo =
    valorPertoDeRotulo(texto, /\(=\)\s*Valor do Documento/) ??
    valorPertoDeRotulo(texto, /Valor do Documento/) ??
    valorPertoDeRotulo(texto, /\(=\)\s*Valor Cobrado/);
  const valor = barras?.valor ?? valorRotulo;

  // Quando as duas fontes divergem, o código de barras vale — mas o usuário
  // precisa saber, porque a diferença costuma ser desconto ou multa.
  if (barras?.valor !== undefined && valorRotulo !== undefined && barras.valor !== valorRotulo) {
    warnings.push(
      `Valor do código de barras (${barras.valor.toFixed(2)}) difere do impresso (${valorRotulo.toFixed(2)}) — confirme qual usar.`
    );
  }

  const data = barras?.vencimento ?? dataPertoDeRotulo(texto, /Vencimento/);

  // Beneficiário: quem recebe. Vira "Fornecedor" no lançamento.
  const porRotulo = primeiroGrupo(
    texto,
    /Benefici[aá]rio\s+([A-ZÀ-Ú][A-ZÀ-Ú0-9\s./&-]{5,60}?)(?:\s{2,}|\s+CNPJ)/
  );
  const benef =
    razaoSocial(texto) ?? (porRotulo && !ROTULOS_BOLETO.test(porRotulo) ? porRotulo : undefined);
  if (benef) metadata.fornecedor = benef.replace(/\s{2,}/g, ' ').trim();

  const cnpj = cnpjDoFornecedor(texto);
  if (cnpj) metadata.cnpj = cnpj;

  // Número do documento fica de fora de propósito. No boleto os rótulos saem
  // todos juntos antes dos valores ("… Número do Documento Espécie do Documento
  // Aceite …" e só depois "25/06/2026 0412078315 DM N"), então acertar exige
  // alinhar as duas sequências por posição — frágil, e cada banco desenha o
  // formulário do seu jeito. Campo opcional: melhor vazio que errado. Resolver
  // isso exigiria OCR/coordenadas da página.

  if (data) metadata.data = data;
  if (valor !== undefined) metadata.valor = valor;

  // Espécie DM/DMI é duplicata mercantil: cobrança lastreada em nota fiscal de
  // fornecedor, classificada como Terceiros. O resto (aluguel,
  // condomínio, mensalidade) cai em Outros Gastos.
  const duplicata = /\bDM\b|\bDMI\b|duplicata/i.test(texto);

  return {
    categoriaSugerida: duplicata ? 'Terceiros' : 'Outros Gastos',
    ...(valor !== undefined ? { valor } : {}),
    ...(data ? { data } : {}),
    descricao: metadata.fornecedor ? `Boleto — ${metadata.fornecedor}` : 'Boleto',
    metadata,
    warnings,
  };
}

/**
 * Lê o documento: identifica o tipo e extrai os campos que dão para extrair.
 *
 * `hoje` entra por parâmetro para o teste ser determinístico (o fator de
 * vencimento do boleto e o vencimento sem ano da fatura dependem da data atual).
 */
export function lerDocumento(texto: string, hoje: Date = new Date()): CamposDocumento {
  const { tipo, confianca } = detectarTipo(texto);

  let campos: Partial<CamposDocumento> = { metadata: {}, warnings: [] };
  if (tipo === 'imposto') campos = lerImposto(texto, hoje);
  else if (tipo === 'fatura_cartao') campos = lerFaturaCartao(texto, hoje);
  else if (tipo === 'boleto') campos = lerBoleto(texto, hoje);
  // nota_fiscal tem parser dedicado no serviço (resolve o cliente pelo CNPJ do
  // tomador); 'desconhecido' fica sem campos.

  const warnings = [...(campos.warnings ?? [])];
  if (tipo === 'desconhecido') {
    warnings.push('Não foi possível identificar o tipo do documento — preencha os campos à mão.');
  }
  if (campos.valor === undefined && tipo !== 'nota_fiscal') {
    warnings.push('Valor não identificado no documento.');
  }
  if (campos.data === undefined && tipo !== 'nota_fiscal') {
    warnings.push('Data de vencimento não identificada no documento.');
  }

  return {
    tipo,
    confianca,
    tipoLancamentoSugerido: DOCUMENTO_TIPO_META[tipo].tipoSugerido,
    ...campos,
    metadata: campos.metadata ?? {},
    warnings,
  };
}
