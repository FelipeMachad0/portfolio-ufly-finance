import api from './api';

export interface NotaRef {
  id: string;
  originalName: string;
  mimetype: string;
  size: number;
}

/** Envia a nota (PDF/imagem) e devolve a referência para anexar ao lançamento. */
export async function uploadNota(file: File): Promise<NotaRef> {
  const form = new FormData();
  form.append('file', file);
  const res = await api.post<NotaRef>('/uploads', form);
  return res.data;
}

/** Se o arquivo pode ser pré-visualizado inline no navegador (PDF/imagem). */
export function canPreview(mimetype: string): boolean {
  return mimetype === 'application/pdf' || mimetype.startsWith('image/');
}

/** Busca o arquivo autenticado como Blob (sem expor URL pública). */
async function fetchNotaBlob(id: string, download = false): Promise<Blob> {
  const res = await api.get(`/uploads/${id}`, {
    params: download ? { download: 1 } : {},
    responseType: 'blob',
  });
  return res.data as Blob;
}

/** Abre a nota em nova aba para pré-visualização (inline). */
export async function previewNota(ref: NotaRef): Promise<void> {
  const blob = await fetchNotaBlob(ref.id, false);
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  // Revoga depois de um tempo para a aba carregar.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Dispara o download da nota com o nome original. */
export async function downloadNota(ref: NotaRef): Promise<void> {
  const blob = await fetchNotaBlob(ref.id, true);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = ref.originalName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
