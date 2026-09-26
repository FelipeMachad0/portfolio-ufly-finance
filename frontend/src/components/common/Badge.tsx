import type { ReactNode } from 'react';

type Tone =
  | 'income'
  | 'expense'
  | 'transfer'
  | 'completed'
  | 'pending'
  | 'cancelled'
  | 'active'
  | 'inactive'
  | 'neutral';

interface Props {
  children: ReactNode;
  tone?: Tone;
  bg?: string;
  fg?: string;
}

const toneVars: Record<Tone, { bg: string; fg: string }> = {
  income:    { bg: 'var(--success-soft)',         fg: 'var(--success-dark)' },
  expense:   { bg: 'var(--danger-soft)',          fg: 'var(--danger-dark)' },
  transfer:  { bg: 'var(--ufly-ice)',             fg: 'var(--ufly-deep)' },
  completed: { bg: 'var(--badge-completed-bg)',   fg: 'var(--badge-completed-fg)' },
  pending:   { bg: 'var(--badge-pending-bg)',     fg: 'var(--badge-pending-fg)' },
  cancelled: { bg: 'var(--badge-cancelled-bg)',   fg: 'var(--badge-cancelled-fg)' },
  active:    { bg: 'var(--badge-active-bg)',      fg: 'var(--badge-active-fg)' },
  inactive:  { bg: 'var(--badge-inactive-bg)',    fg: 'var(--badge-inactive-fg)' },
  neutral:   { bg: 'var(--neutral-100)',          fg: 'var(--neutral-700)' },
};

export function Badge({ children, tone = 'neutral', bg, fg }: Props) {
  const colors = bg && fg ? { bg, fg } : toneVars[tone];
  return (
    <span
      className="inline-block px-2.5 py-0.5 text-xs font-medium whitespace-nowrap"
      style={{ background: colors.bg, color: colors.fg, borderRadius: 'var(--radius-md)' }}
    >
      {children}
    </span>
  );
}
