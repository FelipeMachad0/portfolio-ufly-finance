import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';

export interface ImportRow {
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  category?: string;
  account?: string;
}

export function parseCSV(fileContent: string): ImportRow[] {
  const records = parse(fileContent, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
  return records.map((row) => ({
    date: String(row['date'] ?? row['data'] ?? row['Data'] ?? ''),
    description: String(row['description'] ?? row['descricao'] ?? row['Descrição'] ?? ''),
    amount: parseFloat(String(row['amount'] ?? row['valor'] ?? row['Valor'] ?? '0')),
    type: (['income', 'expense', 'transfer'].includes(String(row['type'] ?? row['tipo'] ?? 'expense'))
      ? String(row['type'] ?? row['tipo'] ?? 'expense')
      : 'expense') as 'income' | 'expense' | 'transfer',
    category: row['category'] ?? row['categoria'] ?? row['Categoria'],
    account: row['account'] ?? row['conta'] ?? row['Conta'],
  }));
}

export function parseXLSX(buffer: Buffer): ImportRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const records = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[];
  return records.map((row) => ({
    date: String(row['date'] ?? row['data'] ?? row['Data'] ?? ''),
    description: String(row['description'] ?? row['Descrição'] ?? row['descricao'] ?? ''),
    amount: parseFloat(String(row['amount'] ?? row['Valor'] ?? row['valor'] ?? '0')),
    type: (['income', 'expense', 'transfer'].includes(String(row['type'] ?? row['Tipo'] ?? 'expense'))
      ? String(row['type'] ?? row['Tipo'] ?? 'expense')
      : 'expense') as 'income' | 'expense' | 'transfer',
    category: row['category'] !== undefined ? String(row['category']) : row['Categoria'] !== undefined ? String(row['Categoria']) : undefined,
    account: row['account'] !== undefined ? String(row['account']) : row['Conta'] !== undefined ? String(row['Conta']) : undefined,
  }));
}
