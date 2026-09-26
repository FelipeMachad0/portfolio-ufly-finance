import type { Request, Response } from 'express';
import type { NotaImportResult } from '@ufly/shared';
import { saveFile } from '../services/storage.service';
import { lerDocumentoFinanceiro } from '../services/leitura-documentos.service';

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

/**
 * POST /api/notas/importar — recebe o documento (multipart 'file'), anexa o
 * arquivo e pede a leitura dos campos.
 *
 * NÃO recebe mais o tipo: a natureza do documento é identificada na extração e
 * volta em extraction.tipoDetectado. Pedir o tipo ao usuário era pedir uma
 * classificação que os próprios documentos não sustentam — uma fatura de cartão
 * contém um boleto, e uma guia de imposto também é paga por código de barras.
 */
export async function importar(req: Request, res: Response): Promise<void> {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'Arquivo não fornecido' });
    return;
  }
  if (!ALLOWED_MIME.has(file.mimetype)) {
    res.status(400).json({ error: 'Tipo de arquivo não permitido (use PDF, JPG, PNG ou WEBP)' });
    return;
  }
  // Anexa o arquivo (fica disponível para o usuário ver depois, junto do lançamento).
  const id = await saveFile(file.buffer, {
    originalName: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
  });

  const extraction = await lerDocumentoFinanceiro({
    buffer: file.buffer,
    mimetype: file.mimetype,
    originalName: file.originalname,
  });

  const result: NotaImportResult = {
    nota: { id, originalName: file.originalname, mimetype: file.mimetype, size: file.size },
    extraction,
  };
  res.status(201).json(result);
}
