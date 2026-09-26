import { readFile } from '../services/storage.service';
import { lerDocumentoFinanceiro, prazoDeLeituraMs } from '../services/leitura-documentos.service';
import {
  listarParaProcessar,
  marcarFalhou,
  marcarLendo,
  marcarPronta,
  reenfileirarOrfas,
  type DocumentoImportado,
} from '../models/documento-importado.model';

/**
 * Processo em segundo plano que lê os documentos da fila.
 *
 * O usuário envia um lote e vai trabalhar; este processo lê cada documento e
 * deixa o resultado pronto para ele confirmar.
 *
 * Roda uma passada por vez (sem sobreposição): duas passadas simultâneas
 * pegariam os mesmos documentos da fila e leriam cada um duas vezes.
 */

let rodando = false;

/** Uma passada: lê tudo o que está na fila. */
export async function passadaDeLeitura(): Promise<void> {
  if (rodando) return;
  rodando = true;
  try {
    const pendentes = await listarParaProcessar();
    for (const doc of pendentes) {
      try {
        await ler(doc);
      } catch (erro) {
        // Um documento problemático não pode parar a fila dos outros.
        console.error(`[leitura] ${doc.id} (${doc.nomeOriginal}):`, (erro as Error).message);
        await marcarFalhou(doc.id, (erro as Error).message);
      }
    }
  } finally {
    rodando = false;
  }
}

async function ler(doc: DocumentoImportado): Promise<void> {
  const arquivo = await readFile(doc.arquivoId);
  if (!arquivo) {
    await marcarFalhou(doc.id, 'O arquivo anexado não foi encontrado no armazenamento.');
    return;
  }

  await marcarLendo(doc.id);
  const extraction = await lerDocumentoFinanceiro({
    buffer: arquivo.buffer,
    mimetype: doc.mimetype,
    originalName: doc.nomeOriginal,
  });
  await marcarPronta(doc.id, extraction);
  console.log(`[leitura] ${doc.nomeOriginal}: pronta (${extraction.provider})`);
}

/**
 * Chamado na subida do backend. Um restart no meio de uma leitura deixaria a
 * linha em `lendo` sem ninguém acompanhando — aqui ela volta para a fila.
 */
export async function recuperarLeiturasInterrompidas(): Promise<void> {
  const minutos = Math.ceil(prazoDeLeituraMs() / 60_000);
  const reenfileiradas = await reenfileirarOrfas(minutos);
  if (reenfileiradas > 0) {
    console.log(`[leitura] ${reenfileiradas} leitura(s) interrompida(s) voltaram para a fila`);
  }
}
