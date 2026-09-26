import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Testa a fila de leitura com o leitor e o storage dublados. O que importa aqui
 * é a decisão: o que vira pronta, o que falha — e que um documento problemático
 * não pare a fila.
 */

const modelo = vi.hoisted(() => ({
  listarParaProcessar: vi.fn(),
  marcarLendo: vi.fn(),
  marcarPronta: vi.fn(),
  marcarFalhou: vi.fn(),
  reenfileirarOrfas: vi.fn(),
}));

const servico = vi.hoisted(() => ({
  lerDocumentoFinanceiro: vi.fn(),
  prazoDeLeituraMs: vi.fn(() => 30 * 60_000),
}));

const storage = vi.hoisted(() => ({ readFile: vi.fn() }));

vi.mock('../../src/models/documento-importado.model', () => modelo);
vi.mock('../../src/services/storage.service', () => storage);
vi.mock('../../src/services/leitura-documentos.service', () => servico);

const { passadaDeLeitura, recuperarLeiturasInterrompidas } = await import(
  '../../src/jobs/leitura-documentos.job'
);

const doc = (over: Record<string, unknown> = {}) => ({
  id: 'doc-1',
  userId: 'u1',
  arquivoId: 'arq-1',
  nomeOriginal: 'boleto.pdf',
  mimetype: 'application/pdf',
  tamanho: 1000,
  status: 'na_fila',
  iniciadoEm: null,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  servico.prazoDeLeituraMs.mockReturnValue(30 * 60_000);
  storage.readFile.mockResolvedValue({ buffer: Buffer.from('pdf') });
  servico.lerDocumentoFinanceiro.mockResolvedValue({ provider: 'local', warnings: [] });
});

describe('fila de leitura de documentos', () => {
  it('lê o que está na fila e marca como pronta', async () => {
    modelo.listarParaProcessar.mockResolvedValue([doc()]);

    await passadaDeLeitura();

    expect(modelo.marcarLendo).toHaveBeenCalledWith('doc-1');
    expect(servico.lerDocumentoFinanceiro).toHaveBeenCalledWith(
      expect.objectContaining({ mimetype: 'application/pdf', originalName: 'boleto.pdf' })
    );
    expect(modelo.marcarPronta).toHaveBeenCalledWith('doc-1', { provider: 'local', warnings: [] });
  });

  it('falha quando o anexo não está mais no armazenamento', async () => {
    storage.readFile.mockResolvedValue(null);
    modelo.listarParaProcessar.mockResolvedValue([doc()]);

    await passadaDeLeitura();

    expect(servico.lerDocumentoFinanceiro).not.toHaveBeenCalled();
    expect(modelo.marcarFalhou).toHaveBeenCalledWith('doc-1', expect.stringMatching(/não foi encontrado/i));
  });

  it('um documento com erro não impede os outros da fila', async () => {
    modelo.listarParaProcessar.mockResolvedValue([doc({ id: 'ruim' }), doc({ id: 'bom' })]);
    servico.lerDocumentoFinanceiro
      .mockRejectedValueOnce(new Error('PDF corrompido'))
      .mockResolvedValueOnce({ provider: 'local', warnings: [] });

    await passadaDeLeitura();

    expect(modelo.marcarFalhou).toHaveBeenCalledWith('ruim', 'PDF corrompido');
    expect(modelo.marcarPronta).toHaveBeenCalledWith('bom', expect.anything());
  });

  it('não sobrepõe passadas', async () => {
    let liberar: (() => void) | undefined;
    modelo.listarParaProcessar.mockImplementation(
      () => new Promise((r) => (liberar = () => r([])))
    );

    const primeira = passadaDeLeitura();
    await passadaDeLeitura(); // deve sair na hora, sem consultar de novo
    liberar?.();
    await primeira;

    expect(modelo.listarParaProcessar).toHaveBeenCalledOnce();
  });

  it('na subida, devolve à fila as leituras interrompidas além do prazo', async () => {
    servico.prazoDeLeituraMs.mockReturnValue(10 * 60_000);
    modelo.reenfileirarOrfas.mockResolvedValue(2);

    await recuperarLeiturasInterrompidas();

    expect(modelo.reenfileirarOrfas).toHaveBeenCalledWith(10);
  });
});
