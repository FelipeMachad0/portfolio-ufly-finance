import type { ReactNode, HTMLAttributes } from 'react';

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: 'sm' | 'md' | 'lg' | 'none';
}

const paddingMap = { none: '', sm: 'p-3', md: 'p-5', lg: 'p-6' } as const;

export function Card({ children, padding = 'md', className = '', style, ...rest }: Props) {
  return (
    <div
      {...rest}
      className={`bg-white ${paddingMap[padding]} ${className}`}
      style={{
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        border: '1px solid var(--neutral-100)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
