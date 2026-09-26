import type { CategoryField } from '@ufly/shared';

interface Props {
  field: CategoryField;
  value: unknown;
}

const EMPTY = (
  <span style={{ color: 'var(--neutral-400)' }}>—</span>
);

function fmtBRL(val: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val);
}

function fmtDate(iso: string): string {
  // YYYY-MM-DD vindo do metadata é tratado como data civil — usar UTC para
  // não puxar para o dia anterior por fuso horário.
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

/**
 * Versão string do valor formatado (mesma lógica da célula), usada pelo
 * filtro de coluna. Valor vazio vira string vazia.
 */
export function formatFieldValue(field: CategoryField, value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  switch (field.type) {
    case 'date':
      return fmtDate(String(value));
    case 'currency': {
      const n = typeof value === 'number' ? value : Number(value);
      return Number.isFinite(n) ? fmtBRL(n) : '';
    }
    case 'number': {
      const n = typeof value === 'number' ? value : Number(value);
      return Number.isFinite(n) ? n.toLocaleString('pt-BR') : '';
    }
    case 'boolean':
      return value ? 'Sim' : 'Não';
    default:
      return String(value);
  }
}

/**
 * Renderiza o valor de um campo dinâmico para exibição em célula de tabela,
 * formatando por tipo. Valores vazios viram um traço em cinza.
 */
export function DynamicFieldCell({ field, value }: Props) {
  if (value === null || value === undefined || value === '') return EMPTY;

  switch (field.type) {
    case 'date':
      return <>{fmtDate(String(value))}</>;

    case 'currency': {
      const n = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(n)) return EMPTY;
      return (
        <span className="font-mono tabular-nums">{fmtBRL(n)}</span>
      );
    }

    case 'number': {
      const n = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(n)) return EMPTY;
      return (
        <span className="font-mono tabular-nums">
          {n.toLocaleString('pt-BR')}
        </span>
      );
    }

    case 'boolean':
      return <>{value ? 'Sim' : 'Não'}</>;

    case 'select':
    case 'string':
    case 'textarea':
    default:
      return <>{String(value)}</>;
  }
}
