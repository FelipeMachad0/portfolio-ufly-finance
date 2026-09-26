/**
 * Iniciais para o avatar: primeira letra do primeiro nome + primeira do último.
 *
 * Antes eram os dois primeiros caracteres do e-mail, o que produzia coisas como
 * "CA" para carlos.lima — parecia um pedaço de palavra, não iniciais.
 *
 * Partículas ("de", "da", "dos", "e"...) são ignoradas: em "Maria de Souza" o
 * sobrenome é Souza, não "de".
 */
const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'di', 'du', 'del', 'la']);

export function iniciaisDoUsuario(nome?: string | null, email?: string | null): string {
  const partes = (nome ?? '')
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 0 && !PARTICULAS.has(p.toLowerCase()));

  if (partes.length >= 2) {
    return (partes[0]![0]! + partes[partes.length - 1]![0]!).toUpperCase();
  }
  if (partes.length === 1) {
    return partes[0]!.slice(0, 2).toUpperCase();
  }

  // Sem nome: tenta o e-mail, que costuma vir como nome.sobrenome@dominio.
  const usuario = (email ?? '').split('@')[0] ?? '';
  const pedacos = usuario.split(/[._-]+/).filter(Boolean);
  if (pedacos.length >= 2) {
    return (pedacos[0]![0]! + pedacos[pedacos.length - 1]![0]!).toUpperCase();
  }
  if (pedacos.length === 1) {
    return pedacos[0]!.slice(0, 2).toUpperCase();
  }
  return '??';
}
