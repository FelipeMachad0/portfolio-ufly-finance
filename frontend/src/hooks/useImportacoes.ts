import { useCallback, useEffect, useState } from 'react';
import { listarImportacoes, type Importacao } from '../services/importacoes.service';

/**
 * Acompanha as leituras de documento do usuário.
 *
 * Consulta periódica em vez de push: a leitura leva minutos e a pessoa não fica
 * olhando a tela, então precisão de segundos não vale um canal aberto. O
 * intervalo só corre quando há leitura em andamento — sem nada na fila, uma
 * consulta a cada 15s para sempre seria desperdício em todas as páginas.
 */

const INTERVALO_MS = 15_000;

export function useImportacoes(): {
  importacoes: Importacao[];
  prontas: Importacao[];
  emAndamento: number;
  recarregar: () => Promise<void>;
} {
  const [importacoes, setImportacoes] = useState<Importacao[]>([]);

  const recarregar = useCallback(async () => {
    try {
      setImportacoes(await listarImportacoes());
    } catch {
      // Falha de rede aqui não deve quebrar a página — a próxima tentativa cobre.
    }
  }, []);

  const emAndamento = importacoes.filter(
    (i) => i.status === 'na_fila' || i.status === 'lendo'
  ).length;

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  useEffect(() => {
    if (emAndamento === 0) return;
    const t = setInterval(() => void recarregar(), INTERVALO_MS);
    return () => clearInterval(t);
  }, [emAndamento, recarregar]);

  return {
    importacoes,
    prontas: importacoes.filter((i) => i.status === 'pronta'),
    emAndamento,
    recarregar,
  };
}
