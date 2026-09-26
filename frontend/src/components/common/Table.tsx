import type {
  HTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
  ReactNode,
} from 'react';

export function Table({ children, className = '', ...rest }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div
      className="bg-white overflow-x-auto"
      style={{
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--neutral-100)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <table {...rest} className={`w-full text-sm ${className}`}>
        {children}
      </table>
    </div>
  );
}

export function Thead({ children }: { children: ReactNode }) {
  return (
    <thead style={{ background: 'var(--neutral-50)', borderBottom: '1px solid var(--neutral-200)' }}>
      {children}
    </thead>
  );
}

export function Tbody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function Tr({ children, className = '', ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      {...rest}
      className={`border-b last:border-0 hover:bg-[var(--neutral-50)] transition-colors ${className}`}
      style={{ borderColor: 'var(--neutral-100)' }}
    >
      {children}
    </tr>
  );
}

export function Th({ children, className = '', ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      {...rest}
      className={`text-left px-4 py-3 text-xs uppercase tracking-wider font-semibold ${className}`}
      style={{ color: 'var(--neutral-500)' }}
    >
      {children}
    </th>
  );
}

export function Td({ children, className = '', ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td {...rest} className={`px-4 py-3 ${className}`} style={{ color: 'var(--neutral-900)' }}>
      {children}
    </td>
  );
}
