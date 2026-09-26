interface Props {
  accept?: string;
  onSelect: (file: File | null) => void;
  label?: string;
}

/** Botão estilizado para seleção de arquivo (esconde o input nativo feio). */
export function FilePicker({ accept, onSelect, label = 'Escolher arquivo' }: Props) {
  return (
    <label
      className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg cursor-pointer transition-colors hover:opacity-90"
      style={{
        border: '1px solid var(--neutral-300)',
        background: 'var(--neutral-100)',
        color: 'var(--neutral-700)',
        fontWeight: 500,
      }}
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
      {label}
      <input
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}
