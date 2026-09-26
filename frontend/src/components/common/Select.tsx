import { type SelectHTMLAttributes, type ReactNode, forwardRef } from 'react';

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  children: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, Props>(function Select(
  { label, error, id, className = '', children, ...rest },
  ref
) {
  const selectId = id ?? (label ? `select-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
  return (
    <div className="flex flex-col">
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium mb-1.5" style={{ color: 'var(--neutral-700)' }}>
          {label}
        </label>
      )}
      <select
        {...rest}
        ref={ref}
        id={selectId}
        aria-invalid={!!error}
        className={`px-3 py-2 text-sm focus:outline-none ${className}`}
        style={{
          borderRadius: 'var(--radius-md)',
          border: `1px solid ${error ? 'var(--danger)' : 'var(--neutral-300)'}`,
          background: 'var(--ufly-white)',
          color: 'var(--neutral-900)',
        }}
      >
        {children}
      </select>
      {error && <span className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{error}</span>}
    </div>
  );
});
