import * as XLSX from 'xlsx';

/** Uma coluna da planilha exportada. `format` controla o formato da célula. */
export interface ExportColumn {
  label: string;
  format?: 'date' | 'currency' | 'number';
}

export interface ExportSheet {
  name: string;
  columns: ExportColumn[];
  /** Linhas já na ordem das colunas. */
  rows: unknown[][];
}

/** Excel: nome de aba tem no máximo 31 chars e não aceita : \ / ? * [ ] */
function sanitizeSheetName(name: string, taken: Set<string>): string {
  let base = name.replace(/[:\\/?*[\]]/g, '-').slice(0, 31).trim() || 'Planilha';
  let candidate = base;
  let n = 2;
  while (taken.has(candidate.toLowerCase())) {
    const suffix = ` (${n++})`;
    candidate = base.slice(0, 31 - suffix.length) + suffix;
  }
  taken.add(candidate.toLowerCase());
  return candidate;
}

const CELL_FORMAT: Record<NonNullable<ExportColumn['format']>, string> = {
  date: 'dd/mm/yyyy',
  currency: '#,##0.00',
  number: '#,##0',
};

/** Dias entre 1899-12-30 (serial 0 do Excel) e 1970-01-01. */
const EXCEL_EPOCH_OFFSET = 25569;

/**
 * "2026-01-15" → número de série do Excel.
 *
 * Calculamos à mão em vez de entregar um `Date` para o SheetJS converter: ele usa
 * o fuso LOCAL, e com o offset histórico do epoch (São Paulo tinha LMT −03:06:28
 * em 1899) a data saía um dia atrás, às 23:59:32. Com o serial derivado de UTC o
 * dia civil sai exato em qualquer fuso do servidor.
 */
function dataCivilParaSerial(valor: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (!m) return null;
  const dias = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000;
  return Math.round(dias) + EXCEL_EPOCH_OFFSET;
}

/**
 * Monta a planilha de controle financeiro: uma aba por conjunto de lançamentos
 * (ENTRADA e uma por categoria de saída), com as colunas vindas dos campos
 * configurados no app. Formata datas e valores como números de verdade — não
 * como texto — para que o Excel some e ordene corretamente.
 */
export function controleFinanceiroToBuffer(sheets: ExportSheet[]): Buffer {
  const wb = XLSX.utils.book_new();
  const taken = new Set<string>();

  for (const sheet of sheets) {
    const header = sheet.columns.map((c) => c.label);
    const ws = XLSX.utils.aoa_to_sheet([header, ...sheet.rows]);

    // Formato por coluna (a partir da linha 2, pulando o cabeçalho). Datas vêm
    // como "YYYY-MM-DD" e viram célula numérica com formato de data.
    sheet.columns.forEach((col, colIdx) => {
      if (!col.format) return;
      for (let rowIdx = 1; rowIdx <= sheet.rows.length; rowIdx++) {
        const ref = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx });
        const cell = ws[ref] as XLSX.CellObject | undefined;
        if (!cell || cell.v === null || cell.v === undefined || cell.v === '') continue;
        if (col.format === 'date') {
          const serial = typeof cell.v === 'string' ? dataCivilParaSerial(cell.v) : null;
          // Valor que não é data reconhecível fica como texto, sem virar número.
          if (serial === null) continue;
          cell.t = 'n';
          cell.v = serial;
        }
        cell.z = CELL_FORMAT[col.format];
      }
    });

    // Largura das colunas: cabeçalho vs. maior conteúdo, com teto para não estourar.
    ws['!cols'] = sheet.columns.map((col, colIdx) => {
      const longest = sheet.rows.reduce((max, row) => {
        const v = row[colIdx];
        const len = v instanceof Date ? 10 : String(v ?? '').length;
        return Math.max(max, len);
      }, col.label.length);
      return { wch: Math.min(Math.max(longest + 2, 10), 45) };
    });

    XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName(sheet.name, taken));
  }

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', cellDates: true }) as Buffer;
}

export function transactionsToBuffer(transactions: Array<{
  date: Date | string;
  description: string;
  amount: number | string;
  type: string;
  category_name?: string | null;
  account_name?: string | null;
  status: string;
}>): Buffer {
  const ws = XLSX.utils.json_to_sheet(
    transactions.map((t) => ({
      Data: new Date(t.date).toLocaleDateString('pt-BR'),
      Descrição: t.description,
      Valor: Number(t.amount),
      Tipo: t.type === 'income' ? 'Receita' : t.type === 'expense' ? 'Despesa' : 'Transferência',
      Categoria: t.category_name ?? '-',
      Conta: t.account_name ?? '-',
      Status: t.status === 'completed' ? 'Concluída' : t.status === 'pending' ? 'Pendente' : 'Cancelada',
    }))
  );
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Transações');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

export function reportToBuffer(
  summary: { totalRevenue: number; totalExpense: number; balance: number },
  expensesByCategory: Array<{ name: string; total: number }>,
  revenueByMonth: Array<{ month: string; revenue: number; expense: number }>
): Buffer {
  const wb = XLSX.utils.book_new();

  const wsSummary = XLSX.utils.json_to_sheet([
    { Métrica: 'Receita Total', Valor: summary.totalRevenue },
    { Métrica: 'Despesa Total', Valor: summary.totalExpense },
    { Métrica: 'Saldo', Valor: summary.balance },
  ]);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo');

  const wsExpenses = XLSX.utils.json_to_sheet(
    expensesByCategory.map((e) => ({
      Categoria: e.name,
      Total: e.total,
      Percentual: summary.totalExpense > 0
        ? `${((e.total / summary.totalExpense) * 100).toFixed(2)}%`
        : '0%',
    }))
  );
  XLSX.utils.book_append_sheet(wb, wsExpenses, 'Despesas');

  const wsRevenue = XLSX.utils.json_to_sheet(revenueByMonth.map((r) => ({
    Mês: r.month,
    Receita: r.revenue,
    Despesa: r.expense,
  })));
  XLSX.utils.book_append_sheet(wb, wsRevenue, 'Receita por Mês');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
