import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

/**
 * Camada de storage de arquivos (notas de lançamentos).
 *
 * Implementação atual: disco local (dev). O diretório é configurável por
 * STORAGE_DIR (default: <backend>/uploads). Foi isolada atrás desta interface
 * para que a troca por um object storage (S3 ou equivalente) em produção seja um único arquivo:
 * basta implementar save/read/remove apontando para o bucket e selecionar via
 * STORAGE_DRIVER. Os controllers/serviços não mudam.
 */
export interface StoredFile {
  buffer: Buffer;
  originalName: string;
  mimetype: string;
  size: number;
}

export interface StoredMeta {
  originalName: string;
  mimetype: string;
  size: number;
}

const STORAGE_DIR = process.env.STORAGE_DIR ?? path.join(process.cwd(), 'uploads');

async function ensureDir(): Promise<void> {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
}

/** Salva o arquivo e devolve um id opaco para referência. */
export async function saveFile(
  buffer: Buffer,
  meta: StoredMeta
): Promise<string> {
  await ensureDir();
  const id = crypto.randomUUID();
  await fs.writeFile(path.join(STORAGE_DIR, id), buffer);
  await fs.writeFile(
    path.join(STORAGE_DIR, `${id}.meta.json`),
    JSON.stringify(meta)
  );
  return id;
}

/** Lê o arquivo + metadados, ou null se não existir. */
export async function readFile(id: string): Promise<StoredFile | null> {
  // Protege contra path traversal: id deve ser um UUID.
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  try {
    const buffer = await fs.readFile(path.join(STORAGE_DIR, id));
    const metaRaw = await fs.readFile(
      path.join(STORAGE_DIR, `${id}.meta.json`),
      'utf-8'
    );
    const meta = JSON.parse(metaRaw) as StoredMeta;
    return { buffer, ...meta };
  } catch {
    return null;
  }
}

/** Remove o arquivo (best-effort). */
export async function removeFile(id: string): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  await fs.rm(path.join(STORAGE_DIR, id), { force: true });
  await fs.rm(path.join(STORAGE_DIR, `${id}.meta.json`), { force: true });
}
