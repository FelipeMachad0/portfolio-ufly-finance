import { useRef, useState } from 'react';
import { enviarDocumentos } from '../../services/importacoes.service';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';

const ACCEPT = 'application/pdf,image/png,image/jpeg,image/webp';

const MAXIMO = 5;

interface Props {
  onClose: () => void;
  /** Chamado depois de enfileirar: a leitura corre em segundo plano. */
  onEnfileirado: (quantidade: number) => void;
}

/**
 * Importação de documento em um passo: escolher o arquivo.
 *
 * Antes eram dois passos — o usuário dizia o tipo (nota fiscal, boleto, fatura de
 * cartão, imposto) e só então escolhia o arquivo. Tirar essa pergunta foi decisão
 * de produto: a classificação não se sustenta (uma fatura de cartão contém um
 * boleto; uma guia de imposto também é paga por código de barras), o usuário
 * errava a escolha e nada no app dependia dela. Quem identifica é a leitura, e o tipo
 * volta na tela seguinte só para o usuário conferir.
 */
export function ImportDocumentoDialog({ onClose, onEnfileirado }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [arrastando, setArrastando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const enviar = async (arquivos: File[]) => {
    if (arquivos.length === 0) return;
    if (arquivos.length > MAXIMO) {
      setError(`Envie no máximo ${MAXIMO} documentos por vez.`);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const enfileiradas = await enviarDocumentos(arquivos);
      onEnfileirado(enfileiradas.length);
    } catch (err) {
      setError((err as Error).message || 'Erro ao enviar os documentos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Importar documento" size="lg">
      {error && (
        <p className="text-sm mb-4" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}

      <p className="text-sm mb-4" style={{ color: 'var(--neutral-600)' }}>
        Nota fiscal, boleto, fatura de cartão ou guia de imposto — a leitura
        identifica o documento e preenche o que conseguir. Você confere antes de salvar.
        <br />
        Pode enviar até {MAXIMO} de uma vez: a leitura corre em segundo plano e você
        não precisa esperar nesta tela. Um aviso no topo mostra quando cada uma ficar
        pronta.
      </p>

      <div
        className="rounded-lg p-8 text-center transition-colors"
        style={{
          border: `2px dashed ${arrastando ? 'var(--ufly-cyan)' : 'var(--neutral-300)'}`,
          borderRadius: 'var(--radius-lg)',
          background: arrastando ? 'var(--ufly-cyan-soft)' : 'transparent',
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastando(false);
          const arquivos = Array.from(e.dataTransfer.files ?? []);
          if (arquivos.length && !loading) void enviar(arquivos);
        }}
      >
        <input
          ref={inputRef}
          id="import-doc-input"
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          disabled={loading}
          aria-label="Selecionar documentos para importar"
          onChange={(e) => {
            const arquivos = Array.from(e.target.files ?? []);
            // Limpa o input para que reescolher os mesmos arquivos dispare o onChange.
            e.target.value = '';
            if (arquivos.length) void enviar(arquivos);
          }}
        />
        <label htmlFor="import-doc-input" className="cursor-pointer block">
          <p className="text-5xl mb-3" aria-hidden>
            📎
          </p>
          <p className="text-lg font-semibold" style={{ color: 'var(--neutral-700)' }}>
            Clique ou arraste o documento aqui
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--neutral-500)' }}>
            PDF, JPG, PNG ou WEBP
          </p>
        </label>
        {loading && (
          <p className="mt-4 text-sm" style={{ color: 'var(--ufly-cyan)' }}>
            Lendo o documento…
          </p>
        )}
      </div>

      {/* type="button" é obrigatório: o diálogo também é usado dentro do
          formulário de transação, e o default de <button> é submit. */}
      <div className="flex gap-3 mt-6">
        <Button type="button" variant="ghost" onClick={onClose} disabled={loading} className="flex-1">
          Cancelar
        </Button>
      </div>
    </Modal>
  );
}
