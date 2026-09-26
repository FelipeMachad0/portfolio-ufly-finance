import { useEffect, useMemo, useRef, useState } from 'react';
import type { CategoryField } from '@ufly/shared';
import { sortLabels, type SortDir } from '../../utils/fieldSort';

interface Props {
  /** Campo da coluna — define os rótulos de ordenação pelo tipo. */
  field: CategoryField;
  /** Valores distintos (já formatados) presentes na coluna. '' = vazio. */
  options: string[];
  /** Filtro atual: lista de valores permitidos, ou null quando sem filtro. */
  selected: string[] | null;
  onApply: (selected: string[] | null) => void;
  /** Direção da ordenação ativa nesta coluna (ou null). */
  sortDir: SortDir | null;
  onSort: (dir: SortDir) => void;
}

const VAZIO = '(vazio)';

/**
 * Filtro de coluna estilo planilha, porém simples e com a identidade do
 * projeto: botão de funil no cabeçalho → popover com busca, "Selecionar tudo"
 * e lista de valores marcáveis.
 */
export function ColumnFilter({ field, options, selected, onApply, sortDir, onSort }: Props) {
  const [open, setOpen] = useState(false);
  const labels = sortLabels(field.type);
  const [search, setSearch] = useState('');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);

  const active = selected !== null || sortDir !== null;

  // Ordena valores; vazio por último
  const sorted = useMemo(() => {
    const uniq = Array.from(new Set(options));
    uniq.sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b, 'pt-BR')));
    return uniq;
  }, [options]);

  const openPopover = () => {
    // Inicializa marcados a partir do filtro atual (ou tudo marcado)
    setChecked(new Set(selected ?? sorted));
    setSearch('');
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const visible = sorted.filter((v) =>
    (v === '' ? VAZIO : v).toLowerCase().includes(search.toLowerCase())
  );
  const allVisibleChecked = visible.length > 0 && visible.every((v) => checked.has(v));

  const toggle = (v: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });
  };
  const toggleAllVisible = () => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (allVisibleChecked) visible.forEach((v) => next.delete(v));
      else visible.forEach((v) => next.add(v));
      return next;
    });
  };

  const apply = () => {
    // Se tudo marcado → sem filtro (null)
    if (checked.size === sorted.length) onApply(null);
    else onApply(Array.from(checked));
    setOpen(false);
  };
  const clear = () => {
    onApply(null);
    setOpen(false);
  };

  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openPopover())}
        title="Filtrar coluna"
        className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded transition-colors"
        style={{ color: active ? 'var(--ufly-cyan)' : 'var(--neutral-400)' }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute z-50 mt-1 top-full left-0 w-56 bg-white py-2"
          style={{ borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--neutral-200)' }}
        >
          <div className="px-1 pb-1 mb-1 border-b" style={{ borderColor: 'var(--neutral-100)' }}>
            <button
              type="button"
              onClick={() => { onSort('asc'); setOpen(false); }}
              className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded hover:bg-[var(--neutral-50)]"
              style={{ color: sortDir === 'asc' ? 'var(--ufly-cyan)' : 'var(--neutral-700)', fontWeight: sortDir === 'asc' ? 600 : 400 }}
            >
              <span aria-hidden>↑</span> {labels.asc}
            </button>
            <button
              type="button"
              onClick={() => { onSort('desc'); setOpen(false); }}
              className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded hover:bg-[var(--neutral-50)]"
              style={{ color: sortDir === 'desc' ? 'var(--ufly-cyan)' : 'var(--neutral-700)', fontWeight: sortDir === 'desc' ? 600 : 400 }}
            >
              <span aria-hidden>↓</span> {labels.desc}
            </button>
          </div>

          <div className="px-2 pb-2">
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="w-full px-2 py-1.5 text-sm focus:outline-none"
              style={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--neutral-300)', color: 'var(--neutral-900)' }}
            />
          </div>

          <label className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-[var(--neutral-50)]" style={{ color: 'var(--neutral-700)', fontWeight: 500 }}>
            <input type="checkbox" checked={allVisibleChecked} onChange={toggleAllVisible} className="w-4 h-4 cursor-pointer" />
            Selecionar tudo
          </label>

          <div className="max-h-52 overflow-y-auto border-t" style={{ borderColor: 'var(--neutral-100)' }}>
            {visible.length === 0 && (
              <p className="px-3 py-2 text-xs" style={{ color: 'var(--neutral-400)' }}>Nenhum valor</p>
            )}
            {visible.map((v) => (
              <label key={v || '__empty__'} className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-[var(--neutral-50)]" style={{ color: 'var(--neutral-700)' }}>
                <input type="checkbox" checked={checked.has(v)} onChange={() => toggle(v)} className="w-4 h-4 cursor-pointer" />
                <span className="truncate" style={v === '' ? { color: 'var(--neutral-400)', fontStyle: 'italic' } : undefined}>
                  {v === '' ? VAZIO : v}
                </span>
              </label>
            ))}
          </div>

          <div className="flex items-center gap-2 px-2 pt-2 border-t" style={{ borderColor: 'var(--neutral-100)' }}>
            <button type="button" onClick={apply} className="flex-1 py-1.5 text-sm text-white rounded-md" style={{ background: 'var(--ufly-navy)' }}>
              Aplicar
            </button>
            <button type="button" onClick={clear} className="py-1.5 px-3 text-sm rounded-md" style={{ color: 'var(--neutral-600)' }}>
              Limpar
            </button>
          </div>
        </div>
      )}
    </span>
  );
}
