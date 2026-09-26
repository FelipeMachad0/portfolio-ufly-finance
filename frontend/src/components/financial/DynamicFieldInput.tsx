import type { CategoryField } from '@ufly/shared';
import { Input } from '../common/Input';
import { Select } from '../common/Select';

interface Props {
  field: CategoryField;
  /** Valor atual. Sempre string aqui (o input HTML lida com tipos) — convertemos
   *  na hora do submit. */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

/**
 * Renderiza um input apropriado para um campo dinâmico declarado em
 * `category.fields_schema`. O caller controla o valor (controlled component)
 * e recebe sempre uma `string`; a conversão para number/date/boolean é
 * responsabilidade do form ao montar o `metadata` do submit.
 */
export function DynamicFieldInput({ field, value, onChange, disabled }: Props) {
  const label = field.required ? `${field.label} *` : field.label;

  switch (field.type) {
    case 'date':
      return (
        <Input
          label={label}
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          disabled={disabled}
        />
      );

    case 'string':
      return (
        <Input
          label={label}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          disabled={disabled}
        />
      );

    case 'textarea': {
      const inputId = `dyn-${field.key}`;
      return (
        <div className="flex flex-col">
          <label
            htmlFor={inputId}
            className="text-sm font-medium mb-1.5"
            style={{ color: 'var(--neutral-700)' }}
          >
            {label}
          </label>
          <textarea
            id={inputId}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
            disabled={disabled}
            rows={3}
            className="px-3 py-2 text-sm focus:outline-none resize-y"
            style={{
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--neutral-300)',
              background: 'var(--ufly-white)',
              color: 'var(--neutral-900)',
            }}
          />
        </div>
      );
    }

    case 'number':
      return (
        <Input
          label={label}
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          disabled={disabled}
        />
      );

    case 'currency':
      return (
        <Input
          label={`${label} (R$)`}
          type="number"
          step="0.01"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          disabled={disabled}
        />
      );

    case 'select':
      return (
        <Select
          label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          disabled={disabled}
        >
          <option value="">Selecione</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </Select>
      );

    case 'boolean': {
      const checked = value === 'true' || value === '1';
      const inputId = `dyn-${field.key}`;
      return (
        <div className="flex items-center gap-2 mt-6">
          <input
            id={inputId}
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked ? 'true' : 'false')}
            disabled={disabled}
            className="w-4 h-4 cursor-pointer"
          />
          <label
            htmlFor={inputId}
            className="text-sm font-medium cursor-pointer"
            style={{ color: 'var(--neutral-700)' }}
          >
            {label}
          </label>
        </div>
      );
    }

    default:
      // Tipos vinculados (cliente/empresa/cnpj/projeto) são tratados no
      // próprio formulário (precisam de dados e cascata).
      return null;
  }
}

/**
 * Converte o valor armazenado em `metadata` (qualquer tipo) para a string
 * que alimenta o input controlado. Inverso de `coerceFieldValue`.
 */
export function stringifyFieldValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

/**
 * Converte a string vinda do input para o tipo apropriado para gravação
 * em `metadata`. Retorna `null` quando o valor está vazio.
 */
export function coerceFieldValue(field: CategoryField, raw: string): unknown {
  if (raw === '' || raw === null || raw === undefined) return null;
  switch (field.type) {
    case 'number':
    case 'currency': {
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    }
    case 'boolean':
      return raw === 'true' || raw === '1';
    default:
      return raw;
  }
}
