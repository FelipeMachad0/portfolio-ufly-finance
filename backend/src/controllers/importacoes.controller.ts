import type { Request, Response } from 'express';
import { saveFile } from '../services/storage.service';
import {
  buscarDoUsuario,
  enfileirar,
  listarPendentes,
  marcarConfirmada,
  marcarDescartada,
} from '../models/documento-importado.model';
import { passadaDeLeitura } from '../jobs/leitura-documentos.job';

const MIMES_ACEITOS = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

/**
 * Importação assíncrona de documentos.
 *
 * O upload responde na hora e a leitura corre em segundo plano, então um lote
 * grande de documentos não prende o pedido HTTP nem a tela do usuário.
 *
 * Aceita vários arquivos por vez: cada um vira uma leitura independente, então
 * quem enviou 5 e volta com 2 prontas confirma essas 2 sem esperar as outras.
 */

/** POST /api/importacoes — recebe os arquivos (campo `files`) e enfileira. */
export async function enviar(req: Request, res: Response): Promise<void> {
  const arquivos = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (arquivos.length === 0) {
    res.status(400).json({ error: 'Nenhum arquivo enviado' });
    return;
  }

  const invalido = arquivos.find((a) => !MIMES_ACEITOS.has(a.mimetype));
  if (invalido) {
    res.status(400).json({
      error: `"${invalido.originalname}" não é um tipo aceito (use PDF, JPG, PNG ou WEBP)`,
    });
    return;
  }

  const criadas = [];
  for (const arquivo of arquivos) {
    // O anexo é guardado ANTES da leitura: se a leitura falhar, o documento
    // continua disponível no lançamento e o usuário preenche à mão.
    const arquivoId = await saveFile(arquivo.buffer, {
      originalName: arquivo.originalname,
      mimetype: arquivo.mimetype,
      size: arquivo.size,
    });
    criadas.push(
      await enfileirar({
        userId: req.userId!,
        arquivoId,
        nomeOriginal: arquivo.originalname,
        mimetype: arquivo.mimetype,
        tamanho: arquivo.size,
      })
    );
  }

  // Não espera a passada: o usuário já recebeu a resposta. Serve para a leitura
  // começar sem aguardar o próximo tique do agendador.
  void passadaDeLeitura().catch((e) => console.error('[importacoes]', (e as Error).message));

  res.status(202).json({ importacoes: criadas });
}

/**
 * GET /api/importacoes — a bandeja de quem está pedindo.
 *
 * Só as próprias, de propósito: leitura pendente é rascunho, e ninguém deve
 * confirmar lançamento a partir de um documento que não viu chegar. Depois de
 * confirmado, o lançamento é da plataforma e todos veem, com o anexo para baixar.
 */
export async function listar(req: Request, res: Response): Promise<void> {
  res.json({ importacoes: await listarPendentes(req.userId!) });
}

/** POST /api/importacoes/:id/confirmar — vincula ao lançamento já criado. */
export async function confirmar(req: Request, res: Response): Promise<void> {
  const doc = await buscarDoUsuario(String(req.params.id), req.userId!);
  if (!doc) {
    res.status(404).json({ error: 'Importação não encontrada' });
    return;
  }
  const transactionId = String(req.body?.transactionId ?? '');
  if (!transactionId) {
    res.status(400).json({ error: 'transactionId é obrigatório' });
    return;
  }
  await marcarConfirmada(doc.id, transactionId);
  res.json({ ok: true });
}

/** DELETE /api/importacoes/:id — descarta a leitura sem criar lançamento. */
export async function descartar(req: Request, res: Response): Promise<void> {
  const doc = await buscarDoUsuario(String(req.params.id), req.userId!);
  if (!doc) {
    res.status(404).json({ error: 'Importação não encontrada' });
    return;
  }
  // O anexo NÃO é removido: o arquivo pode já estar referenciado, e apagar
  // arquivo por descarte de rascunho é irreversível por um clique.
  await marcarDescartada(doc.id);
  res.json({ ok: true });
}
