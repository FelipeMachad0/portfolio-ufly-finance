import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

const variantStyles: Record<Variant, CSSProperties> = {
  primary:   { background: 'var(--ufly-navy)',  color: '#fff', border: 'none' },
  secondary: { background: 'var(--ufly-ice)',   color: 'var(--ufly-navy)', border: 'none' },
  danger:    { background: 'var(--danger)',     color: '#fff', border: 'none' },
  ghost:     { background: 'transparent',       color: 'var(--neutral-700)', border: '1px solid var(--neutral-300)' },
};

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  style,
  disabled,
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 font-medium transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses[size]} ${className}`}
      style={{ borderRadius: 'var(--radius-md)', ...variantStyles[variant], ...style }}
    >
      {children}
    </button>
  );
}
