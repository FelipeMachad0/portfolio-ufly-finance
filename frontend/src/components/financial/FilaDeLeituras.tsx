import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { descartarImportacao, type Importacao } from '../../services/importacoes.service';

interface Props {
  /** Leituras prontas para revisar. */
  prontas: Importacao[];
  /** Quantas ainda estão sendo lidas — mostradas como espera, sem bloquear. */
  emAndamento: number;
  /** Leituras que falharam, para o usuário entender e descartar. */
  falhas: Importacao[];
  /** Id da que está aberta no formulário. */
  emRevisao: string | null;
  onRevisar: (importacao: Importacao) => void;
  onMudou: () => void;
}

/**
 * Fila de documentos lidos, esperando confirmação.
 *
 * Existe porque a leitura passou a ser assíncrona e em lote: a pessoa envia até 5
 * documentos, sai navegando, e volta com vários prontos. Cada um é um lançamento
 * a revisar — sem uma fila visível, ela não saberia quantos faltam nem qual está
 * aberto.
 *
 * Os que ainda estão sendo lidos aparecem aqui de propósito, como espera: quem
 * enviou 5 e tem 2 prontos confirma os 2 sem precisar aguardar os outros 3.
 */
export function FilaDeLeituras({
  prontas,
  emAndamento,
  falhas,
  emRevisao,
  onRevisar,
  onMudou,
}: Props) {
  if (prontas.length === 0 && emAndamento === 0 && falhas.length === 0) return null;

  const descartar = async (id: string) => {
    await descartarImportacao(id);
    onMudou();
  };

  return (
    <Card padding="md" className="mb-6">
      <div className="flex items-baseline justify-between mb-3 gap-4">
        <h2
          className="text-sm font-semibold"
          style={{ color: 'var(--neutral-900)', fontFamily: 'var(--font-display)' }}
        >
          Documentos lidos automaticamente
        </h2>
        <span className="text-xs" style={{ color: 'var(--neutral-500)' }}>
          {prontas.length > 0 && `${prontas.length} para revisar`}
          {prontas.length > 0 && emAndamento > 0 && ' · '}
          {emAndamento > 0 && `${emAndamento} sendo lido${emAndamento > 1 ? 's' : ''}`}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {prontas.map((imp, i) => {
          const aberta = imp.id === emRevisao;
          return (
            <button
              key={imp.id}
              onClick={() => onRevisar(imp)}
              className="flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors"
              style={{
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${aberta ? 'var(--ufly-cyan)' : 'var(--neutral-300)'}`,
                background: aberta ? 'var(--ufly-cyan-soft, #EAF4FA)' : 'transparent',
                maxWidth: '18rem',
              }}
              title={imp.nomeOriginal}
            >
              <span
                className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold"
                style={{ background: 'var(--ufly-navy)', color: '#fff' }}
              >
                {i + 1}
              </span>
              <span className="truncate">{imp.nomeOriginal}</span>
            </button>
          );
        })}

        {Array.from({ length: emAndamento }).map((_, i) => (
          <span
            key={`lendo-${i}`}
            className="flex items-center gap-2 px-3 py-2 text-xs"
            style={{
              borderRadius: 'var(--radius-md)',
              border: '1px dashed var(--neutral-300)',
              color: 'var(--neutral-500)',
            }}
          >
            <span
              className="inline-block w-3 h-3 rounded-full border-2 animate-spin"
              style={{ borderColor: 'var(--neutral-300)', borderTopColor: 'var(--ufly-cyan)' }}
              aria-hidden
            />
            lendo…
          </span>
        ))}
      </div>

      {falhas.length > 0 && (
        <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--neutral-200)' }}>
          {falhas.map((f) => (
            <div key={f.id} className="flex items-start justify-between gap-3 text-xs mb-2">
              <div>
                <p className="font-medium" style={{ color: 'var(--neutral-800)' }}>
                  {f.nomeOriginal}
                </p>
                <p style={{ color: 'var(--danger-dark)' }}>
                  {f.erro ?? 'Não foi possível ler o documento.'}
                </p>
              </div>
              <Button variant="secondary" onClick={() => void descartar(f.id)}>
                Descartar
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
