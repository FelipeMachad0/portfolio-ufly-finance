import { type InputHTMLAttributes, forwardRef } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, error, helperText, id, className = '', ...rest },
  ref
) {
  const inputId = id ?? (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
  return (
    <div className="flex flex-col">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium mb-1.5" style={{ color: 'var(--neutral-700)' }}>
          {label}
        </label>
      )}
      <input
        {...rest}
        ref={ref}
        id={inputId}
        aria-invalid={!!error}
        className={`px-3 py-2 text-sm transition-colors focus:outline-none ${className}`}
        style={{
          borderRadius: 'var(--radius-md)',
          border: `1px solid ${error ? 'var(--danger)' : 'var(--neutral-300)'}`,
          background: 'var(--ufly-white)',
          color: 'var(--neutral-900)',
        }}
      />
      {error && <span className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{error}</span>}
      {!error && helperText && (
        <span className="text-xs mt-1" style={{ color: 'var(--neutral-500)' }}>{helperText}</span>
      )}
    </div>
  );
});
