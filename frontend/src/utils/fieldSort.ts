import type { CategoryField } from '@ufly/shared';

export type SortDir = 'asc' | 'desc';

/**
 * Rótulos de ordenação adaptados ao TIPO do campo. Dirigido só por
 * field.type — campos novos ou com tipo alterado ganham o rótulo certo
 * sem mexer no código.
 */
export function sortLabels(type: CategoryField['type']): { asc: string; desc: string } {
  switch (type) {
    case 'date':
      return { asc: 'Mais antigo → mais novo', desc: 'Mais novo → mais antigo' };
    case 'number':
    case 'currency':
      return { asc: 'Menor → maior', desc: 'Maior → menor' };
    case 'boolean':
      return { asc: 'Não → Sim', desc: 'Sim → Não' };
    default:
      return { asc: 'A → Z', desc: 'Z → A' };
  }
}

/** Converte o valor do metadata numa chave comparável conforme o tipo. */
function sortKey(field: CategoryField, value: unknown): number | string | null {
  if (value === null || value === undefined || value === '') return null;
  switch (field.type) {
    case 'number':
    case 'currency': {
      const n = typeof value === 'number' ? value : Number(value);
      return Number.isFinite(n) ? n : null;
    }
    case 'date': {
      const s = String(value);
      const t = /^\d{4}-\d{2}-\d{2}$/.test(s) ? Date.parse(`${s}T00:00:00Z`) : Date.parse(s);
      return Number.isNaN(t) ? null : t;
    }
    case 'boolean':
      return value ? 1 : 0;
    default:
      return String(value).toLowerCase();
  }
}

/**
 * Comparador para ordenar por um campo, na direção dada. Genérico: só depende
 * de field.type. Valores vazios vão sempre para o fim.
 */
export function compareByField(field: CategoryField, dir: SortDir) {
  return (a: unknown, b: unknown): number => {
    const ka = sortKey(field, a);
    const kb = sortKey(field, b);
    if (ka === null && kb === null) return 0;
    if (ka === null) return 1;
    if (kb === null) return -1;
    let cmp: number;
    if (typeof ka === 'number' && typeof kb === 'number') cmp = ka - kb;
    else cmp = String(ka).localeCompare(String(kb), 'pt-BR');
    return dir === 'asc' ? cmp : -cmp;
  };
}
