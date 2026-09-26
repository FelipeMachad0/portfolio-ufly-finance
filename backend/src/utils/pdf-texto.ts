/**
 * Leitura da camada de texto de um PDF.
 *
 * Usa o pdf.js (build `legacy`, que roda em Node sem DOM). A implementação
 * anterior era caseira — inflava os streams e catava o que estava entre
 * parênteses. Medida contra uma amostra de 14 documentos reais, lia 1; o pdf.js
 * lê 11. A diferença é que boleto e fatura usam fontes com encoding próprio e
 * posicionamento por glifo (arrays TJ), que só um parser de verdade resolve.
 *
 * Os 3 que faltam não são falha do parser: 2 são PDFs com senha e 1 é digitalizado
 * (imagem, sem texto). Para esses, só OCR.
 */

export type FalhaLeitura = 'protegido' | 'sem-texto';

export interface ResultadoLeitura {
  texto: string;
  falha?: FalhaLeitura;
}

/**
 * O pdf.js emite avisos no console para praticamente todo PDF do mundo real
 * (fonte sem glifo, campo de formulário desconhecido). Não é problema nosso e
 * poluiria o log da aplicação.
 */
function silenciarAvisos<T>(fn: () => Promise<T>): Promise<T> {
  const original = console.warn;
  console.warn = () => {};
  return fn().finally(() => {
    console.warn = original;
  });
}

/**
 * Carrega um módulo ESM de dentro de código CommonJS.
 *
 * O pdf.js 4 só existe como ESM, e o backend compila para CommonJS. Escrever
 * `await import(...)` direto não resolve: o tsc com `module: commonjs` reescreve
 * a chamada como `require()`, que só carrega ESM no Node 22.12 ou mais novo.
 * Passando o especificador por uma função construída em tempo de execução, o
 * compilador não tem o que reescrever e o `import()` chega inteiro ao Node.
 */
const importarEsm = new Function('caminho', 'return import(caminho)') as (
  caminho: string
) => Promise<typeof import('pdfjs-dist/legacy/build/pdf.mjs')>;

export async function extrairTextoPdf(buffer: Buffer): Promise<ResultadoLeitura> {
  const { getDocument } = await importarEsm('pdfjs-dist/legacy/build/pdf.mjs');

  return silenciarAvisos(async () => {
    let doc;
    try {
      doc = await getDocument({
        // Cópia: o pdf.js assume a posse do buffer e o zera durante o parse, o
        // que corromperia o arquivo que ainda vamos anexar.
        data: new Uint8Array(buffer),
        // Senha vazia abre PDFs que só têm senha de proprietário (restrição de
        // impressão/cópia) — caso da fatura do C6. Senha de abertura de verdade
        // levanta PasswordException.
        password: '',
        isEvalSupported: false,
        useSystemFonts: false,
      }).promise;
    } catch (erro) {
      const nome = (erro as { name?: string })?.name;
      if (nome === 'PasswordException') return { texto: '', falha: 'protegido' as const };
      return { texto: '', falha: 'sem-texto' as const };
    }

    const paginas: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const conteudo = await page.getTextContent();
      paginas.push(
        conteudo.items
          .map((item) => ('str' in item ? item.str : ''))
          .join(' ')
      );
    }
    await doc.destroy();

    // Espaços colapsados: o pdf.js separa por posição, então o mesmo rótulo pode
    // vir com 1 ou 8 espaços dependendo do alinhamento na página.
    const texto = paginas.join('\n').replace(/[ \t ]+/g, ' ').trim();
    if (!texto) return { texto: '', falha: 'sem-texto' as const };
    return { texto };
  });
}
