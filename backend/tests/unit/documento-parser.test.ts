import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  brDateToISO,
  detectarTipo,
  fatorVencimentoISO,
  lerCodigoBarras,
  lerDocumento,
  parseBRL,
} from '../../src/utils/documento-parser';

/**
 * Fixtures = camada de texto de uma amostra de documentos reais, extraída pelo
 * pdf.js (`utils/pdf-texto.ts`) e ANONIMIZADA: nomes, CPFs, CNPJs, endereços,
 * valores e códigos de barras são fictícios (os códigos seguem válidos). Guardamos o texto, não os PDFs:
 * a lógica que pode quebrar é a das regras de leitura, e texto dá diff legível
 * quando um caso muda.
 *
 * Dos 14, 9 estão aqui. Os outros 5 não têm camada de texto para testar:
 *  - 2 PDFs com senha de abertura;
 *  - 3 digitalizados (imagem pura).
 * Esses dependem de OCR — o backend só precisa avisar.
 */
const dir = path.join(__dirname, '..', 'fixtures', 'documentos');
const fixture = (nome: string): string => fs.readFileSync(path.join(dir, nome), 'utf-8');

// Data fixa: o vencimento do boleto vem de um contador de dias e o da fatura de
// cartão não traz o ano, então os dois dependem de "hoje".
const HOJE = new Date('2026-08-05T00:00:00Z');

describe('parseBRL', () => {
  it('converte o formato brasileiro', () => {
    expect(parseBRL('3.482,10')).toBe(3482.1);
    expect(parseBRL('450,00')).toBe(450);
  });

  it('rejeita vazio e zero', () => {
    expect(parseBRL(undefined)).toBeUndefined();
    expect(parseBRL('')).toBeUndefined();
    expect(parseBRL('0,00')).toBeUndefined();
  });
});

describe('brDateToISO', () => {
  it('converte dd/mm/aaaa', () => {
    expect(brDateToISO('24/07/2026')).toBe('2026-07-24');
  });

  it('devolve undefined sem data', () => {
    expect(brDateToISO('Junho/2026')).toBeUndefined();
  });
});

describe('fatorVencimentoISO', () => {
  /**
   * O contador do boleto foi de 1000 (03/07/2000) a 9999 (21/02/2025) e reiniciou
   * em 1000. Então o mesmo fator serve duas datas ~24,6 anos distantes: a escolha
   * é sempre a mais próxima de hoje.
   */
  it('resolve o fator no ciclo atual', () => {
    expect(fatorVencimentoISO(1494, HOJE)).toBe('2026-07-01');
  });

  it('resolve o fator do ciclo antigo quando é o mais próximo', () => {
    expect(fatorVencimentoISO(9999, new Date('2025-01-01T00:00:00Z'))).toBe('2025-02-21');
  });
});

describe('lerCodigoBarras', () => {
  it('lê valor e vencimento da linha digitável', () => {
    const r = lerCodigoBarras(fixture('boleto-condominio.txt'), HOJE);
    expect(r).toEqual({ valor: 450, vencimento: '2026-07-01' });
  });

  it('devolve undefined sem linha digitável', () => {
    expect(lerCodigoBarras('boleto sem código de barras', HOJE)).toBeUndefined();
  });
});

describe('detectarTipo', () => {
  /**
   * A ordem das regras é o que faz a identificação funcionar: a fatura do C6
   * contém um boleto (linha digitável, "boleto" escrito) e o DARF é pago por
   * código de barras. Se "boleto" fosse testado primeiro, os três casariam nele.
   */
  it('identifica fatura de cartão que contém boleto', () => {
    expect(detectarTipo(fixture('fatura-c6.txt')).tipo).toBe('fatura_cartao');
  });

  it('identifica guia de imposto e não boleto', () => {
    expect(detectarTipo(fixture('darf-pis-cofins.txt')).tipo).toBe('imposto');
    expect(detectarTipo(fixture('darf-parcelamento.txt')).tipo).toBe('imposto');
  });

  it('identifica boleto comum', () => {
    expect(detectarTipo(fixture('boleto-aluguel.txt')).tipo).toBe('boleto');
  });

  it('não inventa tipo para texto qualquer', () => {
    const r = detectarTipo('Contrato de prestação de serviços entre as partes.');
    expect(r.tipo).toBe('desconhecido');
    expect(r.confianca).toBe('baixa');
  });
});

describe('lerDocumento — faturas de cartão', () => {
  it('lê a fatura do C6 pelo valor total, não pelo mínimo', () => {
    const r = lerDocumento(fixture('fatura-c6.txt'), HOJE);
    expect(r.tipo).toBe('fatura_cartao');
    expect(r.valor).toBe(18750);
    expect(r.data).toBe('2026-07-01');
    expect(r.categoriaSugerida).toBe('Outros Gastos');
    expect(r.tipoLancamentoSugerido).toBe('expense');
  });

  it('lê a fatura da Cora e avisa que o ano foi inferido', () => {
    const r = lerDocumento(fixture('fatura-cora-matriz.txt'), HOJE);
    expect(r.valor).toBe(6420);
    expect(r.data).toBe('2026-07-15');
    expect(r.warnings.join(' ')).toMatch(/não traz o ano/);
  });

  it('não confunde o valor mínimo com o total', () => {
    // A fatura da filial tem mínimo 441,00 e total 2.940,00. Lançar o mínimo
    // registraria menos do que se deve — pagar o mínimo não zera a fatura.
    const r = lerDocumento(fixture('fatura-cora-filial.txt'), HOJE);
    expect(r.valor).toBe(2940);
  });
});

describe('lerDocumento — boletos', () => {
  it('lê valor e vencimento pelo código de barras', () => {
    const r = lerDocumento(fixture('boleto-condominio.txt'), HOJE);
    expect(r.tipo).toBe('boleto');
    expect(r.valor).toBe(450);
    expect(r.data).toBe('2026-07-01');
  });

  it('identifica o beneficiário e não o inquilino citado no boleto', () => {
    // O boleto de condomínio nomeia o inquilino da unidade, que tem "LTDA" no
    // nome; quem recebe é o condomínio.
    const r = lerDocumento(fixture('boleto-condominio.txt'), HOJE);
    expect(r.metadata.fornecedor).toBe('ADMINISTRAÇÃO CONDOMINIAL EXEMPLO MARINGÁ');
  });

  it('lê boleto de aluguel sem linha digitável, pelo rótulo', () => {
    const r = lerDocumento(fixture('boleto-aluguel.txt'), HOJE);
    expect(r.valor).toBe(990);
    expect(r.data).toBe('2026-07-05');
    expect(r.metadata.fornecedor).toBe('IMOBILIARIA EXEMPLO S/A');
  });

  it('deixa o número do documento em branco em vez de chutar', () => {
    // Os rótulos do boleto saem todos antes dos valores, então o vizinho de
    // "Número do Documento" no texto é "Espécie do Documento" — já preencheu o
    // campo NF com a palavra "Espécie". Campo opcional: melhor vazio que errado.
    const r = lerDocumento(fixture('boleto-aluguel.txt'), HOJE);
    expect(r.metadata.nf).toBeUndefined();
  });

  it('sugere Terceiros para duplicata mercantil', () => {
    // Duplicata (espécie DM/DMI) é cobrança lastreada em nota de fornecedor, que
    // é classificada como Terceiros; aluguel e condomínio são Outros Gastos.
    const r = lerDocumento(fixture('boleto-duplicata.txt'), HOJE);
    expect(r.categoriaSugerida).toBe('Terceiros');
    expect(r.metadata.fornecedor).toBe('SOFTWARE EXEMPLO TECNOLOGIA BRASIL LTDA');
    expect(r.data).toBe('2026-07-15');
  });

  it('não sugere o CNPJ da Ufly como fornecedor', () => {
    const r = lerDocumento(fixture('boleto-duplicata.txt'), HOJE);
    expect(r.metadata.cnpj).not.toMatch(/^41\.287\.365/);
    expect(r.metadata.cnpj).toBe('45.678.923/0001-00');
  });
});

describe('lerDocumento — guias de imposto', () => {
  it('lê o DARF de PIS/Cofins', () => {
    const r = lerDocumento(fixture('darf-pis-cofins.txt'), HOJE);
    expect(r.tipo).toBe('imposto');
    expect(r.valor).toBe(3482.1);
    expect(r.data).toBe('2026-07-24');
    expect(r.categoriaSugerida).toBe('Impostos');
    expect(r.metadata.fornecedor_orgao).toBe('Receita Federal');
    expect(r.metadata.competencia).toBe('2026-06-01');
  });

  it('não escolhe um tributo quando a guia tem vários', () => {
    // PIS e Cofins na mesma guia costumam ser lançados como uma linha só,
    // então o campo "Tipo de Imposto" fica em branco e a lista vai na observação.
    const r = lerDocumento(fixture('darf-pis-cofins.txt'), HOJE);
    expect(r.metadata.tipo_imposto).toBeUndefined();
    expect(String(r.metadata.observacao)).toMatch(/COFINS/);
  });

  it('lê o DARF em formulário, onde os rótulos vêm todos antes dos valores', () => {
    const r = lerDocumento(fixture('darf-parcelamento.txt'), HOJE);
    expect(r.valor).toBe(912.37); // total = principal 822,00 + encargos 90,37
    expect(r.data).toBe('2026-07-31');
  });

  it('classifica contribuição previdenciária como INSS', () => {
    const r = lerDocumento(fixture('darf-inss.txt'), HOJE);
    expect(r.valor).toBe(1130);
    expect(r.data).toBe('2026-07-20');
    expect(r.metadata.tipo_imposto).toBe('INSS');
  });
});

describe('lerDocumento — documento não identificado', () => {
  it('avisa em vez de inventar campos', () => {
    const r = lerDocumento('Ata de reunião do conselho.', HOJE);
    expect(r.tipo).toBe('desconhecido');
    expect(r.valor).toBeUndefined();
    expect(r.warnings.join(' ')).toMatch(/não foi possível identificar/i);
  });
});
