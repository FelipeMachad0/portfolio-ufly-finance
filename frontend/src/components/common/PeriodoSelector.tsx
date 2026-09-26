import { useEffect, useRef, useState } from 'react';

// ─── Tipos e helpers ────────────────────────────────────────────────────────

export type PresetKey =
  | 'tudo'
  | 'este_mes'
  | 'mes_anterior'
  | 'ultimos_3_meses'
  | 'este_ano'
  | 'custom'
  | 'range';

export interface Periodo {
  preset: PresetKey;
  /**
   * Ausentes no preset 'tudo': significa SEM limite de data, e quem consulta a
   * API deve omitir os parâmetros. Antes esse caso usava 1900→2999 como
   * sentinela, o que qualquer consumidor tratava como intervalo real — foi o que
   * quebrou o gráfico de fluxo de caixa, sintetizando 13 mil meses vazios.
   */
  start?: Date;
  end?: Date;
  /** mês 0-based, só relevante quando preset === 'custom' */
  customMonth: number;
  customYear: number;
  /** strings YYYY-MM-DD, só relevante quando preset === 'range' */
  rangeFrom?: string;
  rangeTo?: string;
}

const MESES = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];
const MESES_FULL = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

function monthStart(y: number, m: number) {
  return new Date(y, m, 1);
}
function monthEnd(y: number, m: number) {
  return new Date(y, m + 1, 0, 23, 59, 59);
}

export function buildPeriodo(
  preset: PresetKey,
  customMonth: number,
  customYear: number
): Periodo {
  const now = new Date();
  const cm = now.getMonth();
  const cy = now.getFullYear();
  switch (preset) {
    case 'tudo':
      // Sem filtro de período: start/end ausentes de propósito.
      return { preset, customMonth: cm, customYear: cy };
    case 'este_mes':
      return { preset, start: monthStart(cy, cm), end: monthEnd(cy, cm), customMonth: cm, customYear: cy };
    case 'mes_anterior': {
      const pm = cm === 0 ? 11 : cm - 1;
      const py = cm === 0 ? cy - 1 : cy;
      return { preset, start: monthStart(py, pm), end: monthEnd(py, pm), customMonth: pm, customYear: py };
    }
    case 'ultimos_3_meses': {
      const first = new Date(cy, cm - 2, 1);
      return { preset, start: first, end: monthEnd(cy, cm), customMonth: cm, customYear: cy };
    }
    case 'este_ano':
      return { preset, start: new Date(cy, 0, 1), end: new Date(cy, 11, 31, 23, 59, 59), customMonth: cm, customYear: cy };
    case 'custom':
      return {
        preset,
        start: monthStart(customYear, customMonth),
        end: monthEnd(customYear, customMonth),
        customMonth,
        customYear,
      };
    case 'range':
      // buildRangePeriodo deve ser usado para 'range'
      return buildPeriodo('este_mes', 0, 0);
  }
}

export function buildRangePeriodo(from: string, to: string): Periodo {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T23:59:59`);
  return {
    preset: 'range',
    start,
    end,
    customMonth: start.getMonth(),
    customYear: start.getFullYear(),
    rangeFrom: from,
    rangeTo: to,
  };
}

function fmtDateLabel(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function periodoLabel(p: Periodo): string {
  switch (p.preset) {
    case 'tudo':
      return 'todo o período';
    case 'este_mes':
    case 'mes_anterior':
      return p.start
        ? `${MESES_FULL[p.start.getMonth()]} de ${p.start.getFullYear()}`
        : 'todo o período';
    case 'ultimos_3_meses':
      return 'últimos 3 meses';
    case 'este_ano':
      return p.start ? `${p.start.getFullYear()}` : 'todo o período';
    case 'custom':
      return `${MESES_FULL[p.customMonth]} de ${p.customYear}`;
    case 'range':
      return p.rangeFrom && p.rangeTo
        ? `${fmtDateLabel(p.rangeFrom)} – ${fmtDateLabel(p.rangeTo)}`
        : 'personalizado';
  }
}

/**
 * Parâmetros de data para a API. Vazio no preset 'tudo', o que faz o backend
 * consultar sem filtro de tempo em vez de receber um intervalo fabricado.
 */
export function periodoParams(p: Periodo): { startDate?: string; endDate?: string } {
  if (!p.start || !p.end) return {};
  return { startDate: p.start.toISOString(), endDate: p.end.toISOString() };
}

/** Período padrão para inicialização de páginas. */
export function defaultPeriodo(): Periodo {
  return buildPeriodo('este_mes', 0, 0);
}

// ─── Componente ─────────────────────────────────────────────────────────────

interface PeriodoSelectorProps {
  periodo: Periodo;
  onChange: (p: Periodo) => void;
  /** Exibe o preset "Tudo" (sem filtro de período). Default: true. */
  showTudo?: boolean;
}

const ALL_PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'tudo', label: 'Tudo' },
  { key: 'este_mes', label: 'Este mês' },
  { key: 'mes_anterior', label: 'Mês anterior' },
  { key: 'ultimos_3_meses', label: 'Últimos 3 meses' },
  { key: 'este_ano', label: 'Este ano' },
];

type ActivePopup = 'month' | 'range' | null;

export function PeriodoSelector({ periodo, onChange, showTudo = true }: PeriodoSelectorProps) {
  const [activePopup, setActivePopup] = useState<ActivePopup>(null);
  const PRESETS = showTudo ? ALL_PRESETS : ALL_PRESETS.filter((p) => p.key !== 'tudo');

  // Estado do picker de mês
  const [pickerMonth, setPickerMonth] = useState(periodo.customMonth);
  const [pickerYear, setPickerYear] = useState(periodo.customYear);

  // Estado do picker de intervalo
  const today = new Date().toISOString().slice(0, 10);
  const [rangeFrom, setRangeFrom] = useState(periodo.rangeFrom ?? today);
  const [rangeTo, setRangeTo] = useState(periodo.rangeTo ?? today);

  const monthRef = useRef<HTMLDivElement>(null);
  const rangeRef = useRef<HTMLDivElement>(null);

  // Fecha qualquer popup ao clicar fora
  useEffect(() => {
    function handler(e: MouseEvent) {
      const target = e.target as Node;
      if (
        monthRef.current &&
        !monthRef.current.contains(target) &&
        rangeRef.current &&
        !rangeRef.current.contains(target)
      ) {
        setActivePopup(null);
      }
    }
    if (activePopup) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [activePopup]);

  const openMonthPicker = () => {
    setPickerMonth(periodo.customMonth);
    setPickerYear(periodo.customYear);
    setActivePopup((v) => (v === 'month' ? null : 'month'));
  };

  const openRangePicker = () => {
    if (periodo.rangeFrom) setRangeFrom(periodo.rangeFrom);
    if (periodo.rangeTo) setRangeTo(periodo.rangeTo);
    setActivePopup((v) => (v === 'range' ? null : 'range'));
  };

  const applyMonth = () => {
    onChange(buildPeriodo('custom', pickerMonth, pickerYear));
    setActivePopup(null);
  };

  const applyRange = () => {
    if (!rangeFrom || !rangeTo) return;
    const from = rangeFrom <= rangeTo ? rangeFrom : rangeTo;
    const to = rangeFrom <= rangeTo ? rangeTo : rangeFrom;
    onChange(buildRangePeriodo(from, to));
    setActivePopup(null);
  };

  const currentYear = new Date().getFullYear();

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Presets fixos */}
      {PRESETS.map(({ key, label }) => {
        const active = periodo.preset === key;
        return (
          <button
            key={key}
            onClick={() => {
              onChange(buildPeriodo(key, 0, 0));
              setActivePopup(null);
            }}
            className="px-3 py-1.5 text-sm rounded-lg transition-colors"
            style={{
              background: active ? 'var(--ufly-navy)' : 'var(--neutral-100)',
              color: active ? '#fff' : 'var(--neutral-700)',
              border: active ? '1px solid var(--ufly-navy)' : '1px solid var(--neutral-200)',
              fontWeight: active ? 600 : 400,
            }}
          >
            {label}
          </button>
        );
      })}

      {/* ── Selecionar mês ── */}
      <div className="relative" ref={monthRef}>
        <button
          onClick={openMonthPicker}
          className="px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1.5"
          style={{
            background: periodo.preset === 'custom' ? 'var(--ufly-navy)' : 'var(--neutral-100)',
            color: periodo.preset === 'custom' ? '#fff' : 'var(--neutral-700)',
            border:
              periodo.preset === 'custom'
                ? '1px solid var(--ufly-navy)'
                : '1px solid var(--neutral-200)',
            fontWeight: periodo.preset === 'custom' ? 600 : 400,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          {periodo.preset === 'custom' ? periodoLabel(periodo) : 'Selecionar mês'}
        </button>

        {activePopup === 'month' && (
          <div
            className="absolute top-10 left-0 z-50 p-4 shadow-lg"
            style={{
              background: '#fff',
              border: '1px solid var(--neutral-200)',
              borderRadius: 'var(--radius-lg)',
              minWidth: 240,
            }}
          >
            {/* Navegação de ano */}
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setPickerYear((y) => y - 1)}
                className="w-7 h-7 flex items-center justify-center rounded hover:opacity-70"
                style={{ color: 'var(--neutral-600)', background: 'var(--neutral-100)' }}
              >‹</button>
              <span className="text-sm font-semibold" style={{ color: 'var(--neutral-800)' }}>
                {pickerYear}
              </span>
              <button
                onClick={() => setPickerYear((y) => y + 1)}
                disabled={pickerYear >= currentYear}
                className="w-7 h-7 flex items-center justify-center rounded hover:opacity-70 disabled:opacity-30"
                style={{ color: 'var(--neutral-600)', background: 'var(--neutral-100)' }}
              >›</button>
            </div>

            {/* Grade de meses */}
            <div className="grid grid-cols-3 gap-1 mb-3">
              {MESES.map((m, i) => {
                const isSelected = pickerMonth === i;
                const isFuture = pickerYear >= currentYear && i > new Date().getMonth();
                return (
                  <button
                    key={m}
                    disabled={isFuture}
                    onClick={() => setPickerMonth(i)}
                    className="py-1.5 text-xs rounded transition-colors"
                    style={{
                      background: isSelected ? 'var(--ufly-navy)' : 'transparent',
                      color: isSelected
                        ? '#fff'
                        : isFuture
                          ? 'var(--neutral-300)'
                          : 'var(--neutral-700)',
                      fontWeight: isSelected ? 600 : 400,
                    }}
                  >
                    {m}
                  </button>
                );
              })}
            </div>

            <button
              onClick={applyMonth}
              className="w-full py-2 text-sm text-white rounded-lg"
              style={{ background: 'var(--ufly-cyan)' }}
            >
              Aplicar
            </button>
          </div>
        )}
      </div>

      {/* ── Personalizado (intervalo de datas) ── */}
      <div className="relative" ref={rangeRef}>
        <button
          onClick={openRangePicker}
          className="px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1.5"
          style={{
            background: periodo.preset === 'range' ? 'var(--ufly-navy)' : 'var(--neutral-100)',
            color: periodo.preset === 'range' ? '#fff' : 'var(--neutral-700)',
            border:
              periodo.preset === 'range'
                ? '1px solid var(--ufly-navy)'
                : '1px solid var(--neutral-200)',
            fontWeight: periodo.preset === 'range' ? 600 : 400,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          {periodo.preset === 'range' ? periodoLabel(periodo) : 'Personalizado'}
        </button>

        {activePopup === 'range' && (
          <div
            className="absolute top-10 left-0 z-50 p-4 shadow-lg"
            style={{
              background: '#fff',
              border: '1px solid var(--neutral-200)',
              borderRadius: 'var(--radius-lg)',
              minWidth: 260,
            }}
          >
            <p className="text-xs font-semibold mb-3" style={{ color: 'var(--neutral-600)' }}>
              Selecione o intervalo
            </p>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--neutral-500)' }}>
                  De
                </label>
                <input
                  type="date"
                  value={rangeFrom}
                  max={rangeTo || today}
                  onChange={(e) => setRangeFrom(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-lg"
                  style={{
                    border: '1px solid var(--neutral-300)',
                    color: 'var(--neutral-800)',
                    outline: 'none',
                  }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--neutral-500)' }}>
                  Até
                </label>
                <input
                  type="date"
                  value={rangeTo}
                  min={rangeFrom || undefined}
                  max={today}
                  onChange={(e) => setRangeTo(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-lg"
                  style={{
                    border: '1px solid var(--neutral-300)',
                    color: 'var(--neutral-800)',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <button
              onClick={applyRange}
              disabled={!rangeFrom || !rangeTo}
              className="w-full py-2 text-sm text-white rounded-lg disabled:opacity-40"
              style={{ background: 'var(--ufly-cyan)' }}
            >
              Aplicar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
