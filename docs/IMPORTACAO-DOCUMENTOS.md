# Importação de documentos

Como funciona o cadastro de lançamento a partir de um documento (nota fiscal,
boleto, fatura de cartão, guia de imposto).

## Fluxo

```
Usuário anexa o documento (PDF ou imagem)
        │
        ▼
POST /api/importacoes  (multipart, campo "files", até 5 arquivos)
        │  cada arquivo é guardado e entra na fila (tabela documentos_importados)
        ▼
Job em segundo plano (a cada 20s)
        │  extrai o texto do PDF, identifica o tipo e lê os campos
        ▼
Bandeja do usuário: leituras prontas  { extraction }
        │
        ▼
Formulário de Nova Transação já preenchido
        │  o usuário revisa, corrige e confirma
        ▼
Lançamento criado, com o documento em anexo (visualizar / baixar)
```

O documento é anexado **antes** da leitura. Se a leitura falhar, o usuário ainda
tem o arquivo no lançamento e preenche à mão — nunca se perde o anexo.

## Por que não pedimos o tipo do documento ao usuário

Havia quatro botões de importação (nota fiscal, boleto, fatura de cartão,
imposto) e o usuário escolhia antes de anexar. Isso saiu. Dois motivos:

1. **A classificação não se sustenta.** Uma fatura de cartão *contém* um boleto —
   ela traz linha digitável e a palavra "boleto" no corpo. Uma guia de
   imposto também é paga por código de barras. Medindo marcadores de texto numa
   amostra de 14 documentos reais, o mesmo arquivo casava com dois ou três tipos.
2. **A escolha não servia para nada depois.** A taxonomia do app é a das
   *categorias* (Serviços, Produtos, Terceiros, Impostos, Sócios, Outros Gastos,
   Empréstimos), e os quatro botões não mapeavam nela.

Hoje o tipo é **saída** da leitura, não entrada do usuário: volta em
`extraction.tipoDetectado` com `extraction.confianca`, e a tela mostra os dois
para o usuário conferir. O que realmente importa é `categoriaSugerida`.

## Leitura

A leitura é local: `backend/src/utils/pdf-texto.ts` extrai a camada de texto do
PDF com o pdf.js, e `backend/src/utils/documento-parser.ts` aplica as regras de
cada tipo. As regras foram escritas a partir de uma amostra de 14 documentos
reais (os fixtures de teste são versões anonimizadas deles). Resultado medido:

| | |
|---|---|
| Tipo identificado | 11/11 dos legíveis |
| Valor | 8/8 |
| Vencimento | 9/9 |
| Ilegíveis | 4 (2 PDFs com senha, 2 digitalizados) |

Os ilegíveis não são falha das regras: exigem OCR ou a senha do arquivo. Nesses
casos o documento fica anexado e o usuário preenche os campos à mão.

Duas decisões da leitura que valem registro:

- **Boleto: o código de barras manda.** Valor e vencimento saem da linha
  digitável, não dos rótulos da página. Um boleto tem vários valores parecidos
  (desconto, multa, mora) e a ordem do texto extraído do PDF é imprevisível. Se
  o valor do código de barras divergir do impresso, os dois vão num aviso.
- **Fatura de cartão: nunca o pagamento mínimo.** A leitura pega o
  "Pagamento total". Lançar o mínimo registraria menos do que se deve.

## Resultado da leitura

O formato é o de `NotaExtraction` (`packages/shared/src/schemas/nota.ts`):

```jsonc
{
  "provider": "local",               // local | none (sem texto para ler)
  "tipoDetectado": "boleto",          // nota_fiscal | boleto | fatura_cartao | imposto | desconhecido
  "confianca": "alta",                // alta | media | baixa
  "tipoLancamentoSugerido": "expense",
  "categoriaSugerida": "Terceiros",   // NOME da categoria, não o id
  "amount": 990.00,
  "date": "2026-07-05",               // vencimento, YYYY-MM-DD
  "description": "Boleto — IMOBILIARIA EXEMPLO S/A",
  "metadata": {                        // chaves = keys dos campos da categoria
    "fornecedor": "IMOBILIARIA EXEMPLO S/A",
    "cnpj": "23.456.789/0001-00",
    "data": "2026-07-05",
    "valor": 990.00
  },
  "warnings": ["Confira o valor: há desconto por pagamento antecipado."]
}
```

`categoriaSugerida` vai por **nome** de propósito: é o que a leitura sabe
produzir, e o id é interno do banco. O frontend resolve o id.

`warnings` aparece na tela como aviso ao usuário. Use para tudo que ficou
incerto: preferir avisar a preencher errado em silêncio.

## Tipo de lançamento no formulário

O formulário de Nova Transação tem um seletor **Entrada / Saída**. Ele começa no
tipo da visão em que o usuário estava (Lançamentos → Entradas abre como Entrada)
ou no `tipoLancamentoSugerido` da leitura, e é editável: quem está com pressa não
precisa voltar e trocar de aba para lançar uma saída, nem alternar entre as duas
visões ao cadastrar várias transações seguidas.

Trocar o tipo descarta a categoria selecionada quando ela não pertence ao novo
tipo — senão o lançamento nasceria com tipo e categoria em desacordo.
