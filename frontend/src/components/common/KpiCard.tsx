interface KpiCardProps {
  titulo: string;
  valor: string;
  sub: string;
  cor: string;
  valueColor?: string;
  /** Sem onClick o card é apenas informativo (sem cursor/hover de clique). */
  onClick?: () => void;
}

/**
 * Card de indicador (título + valor + legenda), usado no Dashboard e como
 * total do filtro atual na listagem de lançamentos.
 */
export function KpiCard({ titulo, valor, sub, cor, valueColor, onClick }: KpiCardProps) {
  const clickable = !!onClick;

  return (
    <div
      onClick={onClick}
      className={`bg-white p-5 transition-all${clickable ? ' cursor-pointer hover:-translate-y-0.5' : ''}`}
      style={{
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        border: '1px solid var(--neutral-200)',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: cor }}
        />
        <p
          className="text-xs font-medium"
          style={{ color: 'var(--neutral-500)' }}
        >
          {titulo}
        </p>
      </div>
      <p
        className="font-semibold tabular-nums font-mono whitespace-nowrap leading-tight"
        style={{
          color: valueColor ?? 'var(--neutral-900)',
          // escala com a largura do card para o valor por extenso sempre caber
          fontSize: 'clamp(0.95rem, 1.5vw, 1.4rem)',
        }}
      >
        {valor}
      </p>
      <p className="text-xs mt-1" style={{ color: 'var(--neutral-500)' }}>
        {sub}
      </p>
    </div>
  );
}
