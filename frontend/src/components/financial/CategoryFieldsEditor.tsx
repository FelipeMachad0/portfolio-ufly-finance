import { useId, useState } from 'react';
import type { CategoryField, FieldType } from '@ufly/shared';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { Button } from '../common/Button';

interface Props {
  value: CategoryField[];
  onChange: (next: CategoryField[]) => void;
  /** Quando true, cada chave gerada ganha um sufixo aleatório (no clipboard
   *  + cole entre categorias, p.ex.). Default false. */
  forceUniqueKeys?: boolean;
  /** Texto exibido quando não há campos configurados. */
  emptyHint?: string;
}

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'string', label: 'Texto curto' },
  { value: 'textarea', label: 'Texto longo' },
  { value: 'date', label: 'Data' },
  { value: 'number', label: 'Número' },
  { value: 'currency', label: 'Valor (R$)' },
  { value: 'select', label: 'Lista de opções' },
  { value: 'boolean', label: 'Sim / Não' },
  { value: 'cliente', label: 'Cliente (lista)' },
  { value: 'empresa', label: 'Empresa do cliente' },
  { value: 'cnpj', label: 'CNPJ (automático)' },
  { value: 'projeto', label: 'Projeto do cliente' },
];

/**
 * Converte um label livre em uma chave snake_case válida para a regex
 * [a-z][a-z0-9_]*. Remove acentos, troca espaços/símbolos por `_`, garante
 * primeiro caractere alfabético.
 */
export function slugifyKey(label: string): string {
  let key = label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove diacríticos
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);
  if (!/^[a-z]/.test(key)) key = `f_${key}`.slice(0, 50);
  return key || 'campo';
}

interface FieldDraft extends CategoryField {
  /** UI-only: id estável p/ key do React. */
  _uid: string;
  /** UI-only: se a chave foi congelada (campo já existia ao abrir o form). */
  _keyLocked: boolean;
  /** UI-only: opções do select como string (CSV) — convertida no toCategoryField */
  _optionsCsv: string;
}

function toDraft(field: CategoryField, locked: boolean): FieldDraft {
  return {
    ...field,
    required: field.required ?? false,
    options: field.options ?? [],
    _uid: `${field.key}_${Math.random().toString(36).slice(2, 7)}`,
    _keyLocked: locked,
    _optionsCsv: (field.options ?? []).join(', '),
  };
}

function toCategoryField(draft: FieldDraft): CategoryField {
  const base: CategoryField = {
    key: draft.key,
    label: draft.label,
    type: draft.type,
    required: draft.required,
  };
  if (draft.type === 'select') {
    base.options = draft._optionsCsv
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  return base;
}

export function CategoryFieldsEditor({ value, onChange, forceUniqueKeys = false, emptyHint }: Props) {
  // Drafts mantém estado de UI separado do que sobe para o pai (chaves congeladas
  // para campos já existentes, CSV de opções, etc.)
  const [drafts, setDrafts] = useState<FieldDraft[]>(() =>
    value.map((f) => toDraft(f, true))
  );
  const uidPrefix = useId();

  const propagate = (next: FieldDraft[]) => {
    setDrafts(next);
    onChange(next.map(toCategoryField));
  };

  const handleLabelChange = (uid: string, label: string) => {
    propagate(
      drafts.map((d) => {
        if (d._uid !== uid) return d;
        // Se a chave ainda não foi congelada, regenera a partir do label
        let key = d.key;
        if (!d._keyLocked) {
          key = slugifyKey(label);
          if (forceUniqueKeys) {
            key = `${key}_${Math.random().toString(36).slice(2, 5)}`;
          }
        }
        return { ...d, label, key };
      })
    );
  };

  const handleTypeChange = (uid: string, type: FieldType) => {
    propagate(
      drafts.map((d) => (d._uid !== uid ? d : { ...d, type }))
    );
  };

  const handleRequiredChange = (uid: string, required: boolean) => {
    propagate(
      drafts.map((d) => (d._uid !== uid ? d : { ...d, required }))
    );
  };

  const handleOptionsChange = (uid: string, csv: string) => {
    propagate(
      drafts.map((d) => (d._uid !== uid ? d : { ...d, _optionsCsv: csv }))
    );
  };

  const move = (uid: string, dir: -1 | 1) => {
    const i = drafts.findIndex((d) => d._uid === uid);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= drafts.length) return;
    const next = drafts.slice();
    [next[i], next[j]] = [next[j], next[i]];
    propagate(next);
  };

  const remove = (uid: string) => {
    propagate(drafts.filter((d) => d._uid !== uid));
  };

  const add = () => {
    const baseKey = slugifyKey(`campo_${drafts.length + 1}`);
    const newField: FieldDraft = {
      _uid: `${uidPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      _keyLocked: false,
      _optionsCsv: '',
      key: baseKey,
      label: '',
      type: 'string',
      required: false,
      options: [],
    };
    propagate([...drafts, newField]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs" style={{ color: 'var(--neutral-500)' }}>
          {drafts.length === 0
            ? (emptyHint ?? 'Nenhum campo configurado. Adicione campos para que apareçam no formulário e na tabela ao filtrar por esta categoria.')
            : `${drafts.length} ${drafts.length === 1 ? 'campo' : 'campos'} configurado${drafts.length === 1 ? '' : 's'}.`}
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={add}>
          + Adicionar campo
        </Button>
      </div>

      {drafts.length > 0 && (
        <div className="space-y-2">
          {drafts.map((d, idx) => (
            <FieldRow
              key={d._uid}
              draft={d}
              canMoveUp={idx > 0}
              canMoveDown={idx < drafts.length - 1}
              onLabelChange={(label) => handleLabelChange(d._uid, label)}
              onTypeChange={(type) => handleTypeChange(d._uid, type)}
              onRequiredChange={(req) => handleRequiredChange(d._uid, req)}
              onOptionsChange={(csv) => handleOptionsChange(d._uid, csv)}
              onMoveUp={() => move(d._uid, -1)}
              onMoveDown={() => move(d._uid, 1)}
              onRemove={() => remove(d._uid)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── FieldRow ────────────────────────────────────────────────────────────────

interface RowProps {
  draft: FieldDraft;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onLabelChange: (label: string) => void;
  onTypeChange: (type: FieldType) => void;
  onRequiredChange: (required: boolean) => void;
  onOptionsChange: (csv: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}

function FieldRow({
  draft,
  canMoveUp,
  canMoveDown,
  onLabelChange,
  onTypeChange,
  onRequiredChange,
  onOptionsChange,
  onMoveUp,
  onMoveDown,
  onRemove,
}: RowProps) {
  return (
    <div
      className="p-3 space-y-2"
      style={{
        background: 'var(--neutral-50)',
        border: '1px solid var(--neutral-200)',
        borderRadius: 'var(--radius-md)',
      }}
    >
      <div className="grid grid-cols-12 gap-2 items-end">
        {/* Reordenar */}
        <div className="col-span-1 flex flex-col gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            className="w-6 h-6 flex items-center justify-center disabled:opacity-30"
            style={{
              borderRadius: 'var(--radius-sm)',
              background: 'var(--ufly-white)',
              border: '1px solid var(--neutral-300)',
              color: 'var(--neutral-700)',
            }}
            aria-label="Mover para cima"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            className="w-6 h-6 flex items-center justify-center disabled:opacity-30"
            style={{
              borderRadius: 'var(--radius-sm)',
              background: 'var(--ufly-white)',
              border: '1px solid var(--neutral-300)',
              color: 'var(--neutral-700)',
            }}
            aria-label="Mover para baixo"
          >
            ↓
          </button>
        </div>

        {/* Label */}
        <div className="col-span-5">
          <Input
            label="Nome"
            value={draft.label}
            onChange={(e) => onLabelChange(e.target.value)}
            placeholder="Ex: Data Emissão"
          />
          <p
            className="text-[10px] mt-1 font-mono"
            style={{ color: 'var(--neutral-500)' }}
          >
            chave: {draft.key || '—'}
            {draft._keyLocked && ' (preservada)'}
          </p>
        </div>

        {/* Type */}
        <div className="col-span-3">
          <Select
            label="Tipo"
            value={draft.type}
            onChange={(e) => onTypeChange(e.target.value as FieldType)}
          >
            {FIELD_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>

        {/* Required */}
        <div className="col-span-2 flex items-center gap-1.5">
          <input
            id={`req-${draft._uid}`}
            type="checkbox"
            checked={draft.required ?? false}
            onChange={(e) => onRequiredChange(e.target.checked)}
            className="w-4 h-4 cursor-pointer"
          />
          <label
            htmlFor={`req-${draft._uid}`}
            className="text-sm cursor-pointer"
            style={{ color: 'var(--neutral-700)' }}
          >
            Obrigatório
          </label>
        </div>

        {/* Remove */}
        <div className="col-span-1 flex justify-end">
          <button
            type="button"
            onClick={onRemove}
            className="w-7 h-7 flex items-center justify-center text-sm"
            style={{
              borderRadius: 'var(--radius-sm)',
              background: 'var(--danger-soft)',
              color: 'var(--danger)',
              border: '1px solid var(--danger-soft)',
            }}
            aria-label="Remover campo"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Options (apenas para select) */}
      {draft.type === 'select' && (
        <Input
          label="Opções (separadas por vírgula)"
          value={draft._optionsCsv}
          onChange={(e) => onOptionsChange(e.target.value)}
          placeholder="Pendente, Pago, Atrasado"
        />
      )}
    </div>
  );
}
