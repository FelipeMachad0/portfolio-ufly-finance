import type { Request, Response } from 'express';
import { parseDataOpcional, filtroDePeriodo } from '../utils/date-range';
import type { CategoryField, Empresa } from '@ufly/shared';
import { pool } from '../database/pool';
import { getSummary, getExpensesByCategory, getRevenueVsExpense } from '../services/report.service';
import {
  transactionsToBuffer,
  reportToBuffer,
  controleFinanceiroToBuffer,
  type ExportColumn,
  type ExportSheet,
} from '../utils/xlsx-exporter';
import { findAllTransactions, type Transaction } from '../models/transaction.model';
import { findCategories } from '../models/category.model';
import { getTypeFields } from '../models/typefields.model';
import { findClientes } from '../models/cliente.model';
import { findProjetos } from '../models/projeto.model';

export async function exportTransactions(req: Request, res: Response): Promise<void> {
  try {
    const { startDate, endDate } = req.query;
    const userId = req.userId!;

    // Datas ausentes = exporta tudo. Antes caía no ano corrente por default, o
    // que no preset "Tudo" recortava silenciosamente o resultado.
    const start = parseDataOpcional(startDate);
    const end = parseDataOpcional(endDate);

    const result = await pool.query<{
      date: Date;
      description: string;
      amount: string;
      type: string;
      status: string;
      category_name: string | null;
      account_name: string | null;
    }>(
      `SELECT t.date, t.description, t.amount, t.type, t.status,
              c.name as category_name, a.name as account_name
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       LEFT JOIN accounts a ON t.account_id = a.id
       WHERE t.date BETWEEN $1 AND $2 AND t.deleted_at IS NULL
       ORDER BY t.date DESC`,
      [start, end]
    );

    const buffer = transactionsToBuffer(
      result.rows.map((r) => ({ ...r, amount: Number(r.amount) }))
    );

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="transacoes.xlsx"');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
}

// ─── Planilha de controle financeiro (todas as entradas e saídas) ────────────

/**
 * Chaves de campo dinâmico que repetem as colunas-base (Data e Valor) e por
 * isso são omitidas — evita coluna duplicada na planilha. São a convenção usada
 * nas categorias de saída do app; se a categoria usar outra chave, o campo
 * simplesmente aparece como coluna própria.
 */
const CHAVES_REDUNDANTES = new Set(['data', 'valor']);

const FORMATO_POR_TIPO: Record<string, ExportColumn['format']> = {
  date: 'date',
  currency: 'currency',
  number: 'number',
};

/** Junta campos do tipo + da categoria, sem repetir key (igual à tabela do app). */
function mesclarCampos(...listas: CategoryField[][]): CategoryField[] {
  const out: CategoryField[] = [];
  const vistos = new Set<string>();
  for (const lista of listas) {
    for (const campo of lista) {
      if (vistos.has(campo.key) || CHAVES_REDUNDANTES.has(campo.key)) continue;
      vistos.add(campo.key);
      out.push(campo);
    }
  }
  return out;
}

/**
 * Quando um campo da categoria tem o mesmo rótulo de uma coluna-base (o caso de
 * "Descrição", que existe como campo em algumas categorias), a coluna-base ganha
 * um sufixo. Assim nenhuma coluna é descartada — o Excel não fica com dois
 * cabeçalhos idênticos e nada de dado se perde.
 */
function desambiguarColunasBase(columns: ExportColumn[], fixas: number): ExportColumn[] {
  const rotulosDinamicos = new Set(
    columns.slice(fixas).map((c) => c.label.trim().toLowerCase())
  );
  return columns.map((col, i) =>
    i < fixas && rotulosDinamicos.has(col.label.trim().toLowerCase())
      ? { ...col, label: `${col.label} (lançamento)` }
      : col
  );
}

/**
 * Descarta colunas de campo dinâmico que não têm valor em nenhuma linha da aba.
 * Os campos padrão do tipo e os da categoria se sobrepõem com chaves diferentes
 * (ex.: `numero_nota` do tipo vs `nf` da categoria), o que geraria uma dezena de
 * colunas vazias. As `fixas` primeiras colunas (data, descrição, valor,
 * categoria) ficam sempre, mesmo vazias.
 */
function removerColunasVazias(
  columns: ExportColumn[],
  rows: unknown[][],
  fixas: number
): { columns: ExportColumn[]; rows: unknown[][] } {
  const manter = columns.map(
    (_, i) =>
      i < fixas ||
      rows.some((linha) => {
        const v = linha[i];
        return v !== '' && v !== null && v !== undefined;
      })
  );
  const podadas = manter.every(Boolean)
    ? { columns, rows }
    : {
        columns: columns.filter((_, i) => manter[i]),
        rows: rows.map((linha) => linha.filter((_, i) => manter[i])),
      };
  return { ...podadas, columns: desambiguarColunasBase(podadas.columns, fixas) };
}

/**
 * Datas vão para o exportador como "YYYY-MM-DD" (data civil, sem fuso) — é ele
 * que converte para o número de série do Excel. `transactions.date` chega à
 * meia-noite UTC, então lemos as partes em UTC para não escorregar um dia.
 */
function isoDoLancamento(d: Date): string {
  const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(d.getUTCDate()).padStart(2, '0');
  return `${d.getUTCFullYear()}-${mes}-${dia}`;
}

/**
 * Converte o valor cru do metadata para o que vai na célula. Datas viram Date e
 * moedas viram número (para o Excel somar); IDs de cliente/projeto viram nome.
 */
function valorDaCelula(
  campo: CategoryField,
  valor: unknown,
  nomePorId: Map<string, string>
): unknown {
  if (valor === null || valor === undefined || valor === '') return '';
  switch (campo.type) {
    case 'date':
      // Já vem "YYYY-MM-DD" do metadata; o exportador converte para data do Excel.
      return String(valor);
    case 'currency':
    case 'number': {
      const n = typeof valor === 'number' ? valor : Number(valor);
      return Number.isFinite(n) ? n : '';
    }
    case 'boolean':
      return valor ? 'Sim' : 'Não';
    case 'cliente':
    case 'projeto':
    case 'empresa':
      // O metadata guarda ora o id (formulário), ora o nome (dados importados).
      return nomePorId.get(String(valor)) ?? String(valor);
    default:
      return String(valor);
  }
}

/**
 * GET /api/export/completo — planilha com TODOS os lançamentos, no formato da
 * planilha de controle financeiro: uma aba ENTRADA e uma aba por categoria de
 * saída, com as colunas vindas dos campos configurados em cada categoria.
 */
export async function exportControleFinanceiro(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const [transacoes, categorias, camposDeTipo, clientes, projetos] = await Promise.all([
      findAllTransactions(),
      findCategories(),
      getTypeFields(),
      findClientes(),
      findProjetos(),
    ]);

    // Resolve ids -> nomes para cliente, empresa e projeto.
    const nomePorId = new Map<string, string>();
    for (const c of clientes) {
      nomePorId.set(c.id, c.nome);
      for (const emp of ((c.empresas as unknown as Empresa[]) ?? [])) {
        if (emp.nome) nomePorId.set(emp.nome, emp.nome);
      }
    }
    for (const p of projetos) nomePorId.set(p.id, p.nome);

    const categoriaPorId = new Map(categorias.map((c) => [c.id, c]));
    const porCategoria = new Map<string, Transaction[]>();
    const entradas: Transaction[] = [];
    const transferencias: Transaction[] = [];

    for (const t of transacoes) {
      if (t.type === 'income') {
        entradas.push(t);
      } else if (t.type === 'expense') {
        // Sem categoria vai para uma aba própria, para nenhum lançamento sumir.
        const chave = t.category_id ?? '';
        const lista = porCategoria.get(chave) ?? [];
        lista.push(t);
        porCategoria.set(chave, lista);
      } else {
        transferencias.push(t);
      }
    }

    const COLUNAS_BASE: ExportColumn[] = [
      { label: 'Data', format: 'date' },
      { label: 'Descrição' },
      { label: 'Valor (R$)', format: 'currency' },
    ];
    const montarLinha = (t: Transaction, campos: CategoryField[], extra: unknown[] = []) => [
      isoDoLancamento(t.date),
      t.description,
      Number(t.amount),
      ...extra,
      ...campos.map((f) => valorDaCelula(f, t.metadata?.[f.key], nomePorId)),
    ];

    const abas: ExportSheet[] = [];

    // ENTRADA: Produtos e Serviços juntos, distinguidos pela coluna Categoria.
    if (entradas.length > 0) {
      const categoriasDeEntrada = categorias.filter((c) => c.type === 'income');
      const campos = mesclarCampos(
        camposDeTipo.income,
        ...categoriasDeEntrada.map((c) => c.fields_schema ?? [])
      );
      abas.push({
        name: 'ENTRADA',
        ...removerColunasVazias(
          [
            ...COLUNAS_BASE,
            { label: 'Categoria' },
            ...campos.map((f) => ({ label: f.label, format: FORMATO_POR_TIPO[f.type] })),
          ],
          entradas.map((t) =>
            montarLinha(t, campos, [
              t.category_id ? categoriaPorId.get(t.category_id)?.name ?? '' : '',
            ])
          ),
          COLUNAS_BASE.length + 1
        ),
      });
    }

    // Uma aba por categoria de saída, na ordem alfabética da categoria.
    const chavesOrdenadas = [...porCategoria.keys()].sort((a, b) => {
      const na = categoriaPorId.get(a)?.name ?? '';
      const nb = categoriaPorId.get(b)?.name ?? '';
      return na.localeCompare(nb, 'pt-BR');
    });
    for (const chave of chavesOrdenadas) {
      const categoria = categoriaPorId.get(chave);
      const campos = mesclarCampos(camposDeTipo.expense, categoria?.fields_schema ?? []);
      abas.push({
        name: `SAÍDA - ${categoria?.name ?? 'Sem categoria'}`,
        ...removerColunasVazias(
          [
            ...COLUNAS_BASE,
            ...campos.map((f) => ({ label: f.label, format: FORMATO_POR_TIPO[f.type] })),
          ],
          (porCategoria.get(chave) ?? []).map((t) => montarLinha(t, campos)),
          COLUNAS_BASE.length
        ),
      });
    }

    if (transferencias.length > 0) {
      abas.push({
        name: 'TRANSFERÊNCIAS',
        columns: COLUNAS_BASE,
        rows: transferencias.map((t) => montarLinha(t, [])),
      });
    }

    if (abas.length === 0) {
      abas.push({ name: 'ENTRADA', columns: COLUNAS_BASE, rows: [] });
    }

    const buffer = controleFinanceiroToBuffer(abas);
    const hoje = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="controle-financeiro-${hoje}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function exportReport(req: Request, res: Response): Promise<void> {
  try {
    const { startDate, endDate } = req.query;
    const userId = req.userId!;

    // Datas ausentes = exporta tudo. Antes caía no ano corrente por default, o
    // que no preset "Tudo" recortava silenciosamente o resultado.
    const start = parseDataOpcional(startDate);
    const end = parseDataOpcional(endDate);

    const [summary, expenses, revenue] = await Promise.all([
      getSummary(userId, start, end),
      getExpensesByCategory(userId, start, end),
      getRevenueVsExpense(userId, start, end),
    ]);

    const buffer = reportToBuffer(summary, expenses, revenue);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="relatorio-financeiro.xlsx"');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
}
