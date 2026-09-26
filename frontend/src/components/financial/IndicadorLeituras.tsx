import { useNavigate } from 'react-router-dom';
import { useImportacoes } from '../../hooks/useImportacoes';

/**
 * Indicador de leituras de documento, no cabeçalho.
 *
 * Fica aqui, e não numa página própria, porque a leitura acontece em segundo
 * plano: a pessoa envia os documentos e sai navegando. Sem um aviso visível de
 * qualquer tela, ela não teria como saber que as leituras ficaram prontas — nem
 * por onde voltar para confirmá-las.
 *
 * Não aparece quando não há nada pendente: cabeçalho é espaço caro.
 */
export function IndicadorLeituras() {
  const navigate = useNavigate();
  const { prontas, emAndamento } = useImportacoes();

  const total = prontas.length + emAndamento;
  if (total === 0) return null;

  const rotulo =
    prontas.length > 0
      ? `${prontas.length} ${prontas.length === 1 ? 'leitura pronta' : 'leituras prontas'}`
      : `${emAndamento} ${emAndamento === 1 ? 'documento sendo lido' : 'documentos sendo lidos'}`;

  return (
    <button
      onClick={() => navigate('/transactions?revisar=1')}
      className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-opacity hover:opacity-90"
      style={{
        background: prontas.length > 0 ? 'var(--ufly-cyan)' : 'rgba(255,255,255,0.12)',
        color: prontas.length > 0 ? 'var(--ufly-navy)' : '#fff',
      }}
      title={
        prontas.length > 0
          ? 'Revisar e confirmar as leituras prontas'
          : 'Lendo os documentos enviados'
      }
    >
      {prontas.length === 0 && (
        // Só gira enquanto há leitura em andamento — animação perpétua no
        // cabeçalho vira ruído.
        <span
          className="inline-block w-3 h-3 rounded-full border-2 animate-spin"
          style={{ borderColor: 'rgba(255,255,255,0.35)', borderTopColor: '#fff' }}
          aria-hidden
        />
      )}
      {rotulo}
    </button>
  );
}
