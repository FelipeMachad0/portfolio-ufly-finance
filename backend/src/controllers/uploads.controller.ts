import type { Request, Response } from 'express';
import { saveFile, readFile } from '../services/storage.service';

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  // Word (.doc / .docx)
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export interface NotaRef {
  id: string;
  originalName: string;
  mimetype: string;
  size: number;
}

/** POST /api/uploads — recebe a nota (multipart 'file') e devolve a referência. */
export async function upload(req: Request, res: Response): Promise<void> {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'Arquivo não fornecido' });
    return;
  }
  if (!ALLOWED_MIME.has(file.mimetype)) {
    res.status(400).json({ error: 'Tipo de arquivo não permitido (use PDF, JPG, PNG ou WEBP)' });
    return;
  }
  const id = await saveFile(file.buffer, {
    originalName: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
  });
  const ref: NotaRef = {
    id,
    originalName: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
  };
  res.status(201).json(ref);
}

/**
 * GET /api/uploads/:id — serve a nota para preview (inline) ou download
 * (?download=1). O frontend busca via fetch autenticado (blob).
 */
export async function serve(req: Request, res: Response): Promise<void> {
  const stored = await readFile(req.params.id as string);
  if (!stored) {
    res.status(404).json({ error: 'Arquivo não encontrado' });
    return;
  }
  const disposition = req.query.download ? 'attachment' : 'inline';
  res.setHeader('Content-Type', stored.mimetype);
  res.setHeader('Content-Length', String(stored.size));
  res.setHeader(
    'Content-Disposition',
    `${disposition}; filename="${encodeURIComponent(stored.originalName)}"`
  );
  res.send(stored.buffer);
}
