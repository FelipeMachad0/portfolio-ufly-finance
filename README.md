# Ufly Controle Financeiro

Sistema web de gestão financeira empresarial, desenvolvido para a **uFly** e
publicado aqui como portfolio, com autorização da empresa.

> **Sobre esta versão:** é uma cópia do código de produção sem dados
> confidenciais e sem as integrações internas da empresa. Todos os dados de
> exemplo e os fixtures de teste são fictícios.

## Demonstração

**Online (GitHub Pages):** https://felipemachad0.github.io/portfolio-ufly-finance/ — clique
em **Entrar como demonstração**. Essa versão roda inteira no navegador: as
chamadas da API são respondidas a partir de dados fictícios
(`frontend/src/demo/dados.json`), sem servidor nem banco. Criar e editar
funciona durante a visita; upload, importação e exportação XLSX pedem a versão
completa.

**Completa, na sua máquina** (só precisa de Node.js 20+):

```bash
npm install
npm run demo
```

O comando sobe um PostgreSQL embutido ([PGlite](https://pglite.dev)), aplica as
migrations e inicia backend e frontend em modo demonstração. Abra
http://localhost:5173 e clique em **Entrar como demonstração**. Para zerar os
dados, apague `backend/.demo-db/`.

## Funcionalidades

- **Lançamentos** de receitas e despesas, com filtros por coluna, paginação e
  anexos (nota fiscal, boleto e comprovante para visualizar ou baixar)
- **Campos dinâmicos por categoria/tipo**: cada categoria define o próprio
  schema de campos, guardados em JSONB
- **Importação de documentos em lote**, em segundo plano: o usuário envia vários
  PDFs, e uma fila persistida no Postgres lê cada um e pré-preenche o lançamento
  para ele conferir e confirmar
  - identifica sozinho o tipo (nota fiscal, boleto, fatura de cartão, guia de
    imposto), sem pedir ao usuário
  - no boleto, valor e vencimento saem da linha digitável
  - na nota fiscal de serviço, resolve o cliente pelo CNPJ do tomador e separa
    os impostos retidos
- **Importação de planilhas** CSV/XLSX, com preview e detecção de duplicatas
- **Exportação** de lançamentos e relatórios em XLSX
- **Dashboard e relatórios**: fluxo de caixa, receita x despesa, despesas por
  categoria, receita por cliente e DRE
- **Orçamentos e centros de custo**: previsto x realizado por período, gestor
  responsável e alertas de limite por e-mail (job diário)
- **Clientes** (com várias empresas/CNPJs), **projetos**, **fornecedores** e
  **contas**
- **Autenticação Microsoft Entra ID (MSAL)**: o token do Entra é verificado no
  backend e trocado por um JWT da aplicação
- **Papéis via grupos do Entra**: os grupos são mapeados para GESTOR_GERAL,
  GESTOR_DEPARTAMENTO, AUDITOR e USUARIO, com provisionamento no primeiro login
- **Auditoria** de eventos sensíveis

## Stack

| Camada | Tecnologias |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, React Router, Recharts, MSAL Browser |
| Backend | Node.js, Express 5, TypeScript, Prisma (PostgreSQL), Zod, node-schedule, pdf.js, xlsx |
| Compartilhado | `packages/shared`: schemas Zod e tipos usados pelos dois lados |
| Testes | Vitest e Testing Library |
| Infra | Docker, docker-compose, Caddy (TLS automático), nginx, GitHub Actions (Pages) |

## Arquitetura

- **Monorepo com npm workspaces.** Os schemas Zod de `packages/shared` validam
  a entrada no backend e os formulários no frontend: uma regra, um lugar.
- **Backend em camadas**: `routes → controllers → services → models`. Os models
  usam o Prisma; agregações de relatório usam SQL direto.
- **Autenticação:** o frontend faz o login no Entra ID (MSAL, fluxo SPA) e envia
  o `idToken` ao backend, que o verifica contra as chaves do tenant e emite o JWT
  da aplicação. O papel vem dos grupos do Entra (`entra_group_mapping`).
- **Leitura de documentos assíncrona:** o upload responde `202` na hora, e um
  job (`node-schedule`) processa a fila `documentos_importados`. Um restart no
  meio da leitura devolve o documento à fila.
- **Configuração de runtime no frontend:** a imagem Docker gera `config.js` no
  startup, então a mesma imagem roda em qualquer ambiente sem rebuild.
- **Três formas de rodar**, com o mesmo código: produção (Postgres + Entra ID),
  demo completa (`npm run demo`, Postgres embutido) e demo estática (GitHub
  Pages, API no navegador).

## Estrutura

```
├── packages/shared/   # Schemas Zod + tipos compartilhados
├── backend/           # API REST (Express + Prisma)
│   ├── prisma/        # schema e migrations
│   ├── scripts/       # demo (npm run demo) e exportação dos dados fictícios
│   ├── src/
│   │   ├── controllers/ routes/ services/ models/
│   │   ├── jobs/      # alertas de orçamento, fila de leitura de documentos
│   │   └── utils/     # parser de documentos, leitura de PDF, JWT, XLSX...
│   └── tests/         # testes unitários + fixtures (fictícias)
├── frontend/          # SPA React (Vite)
│   └── src/demo/      # API estática + dados fictícios (GitHub Pages)
├── deploy/caddy/      # TLS e roteamento na borda
├── docs/              # API e importação de documentos
└── docker-compose.yml # stack completa: Postgres + backend + frontend + Caddy
```

## Rodando com um PostgreSQL próprio

```bash
npm install
npm run build --workspace=@ufly/shared            # o backend consome o dist do shared
cp backend/.env.example backend/.env.development   # DATABASE_URL, JWT_SECRET...
cp frontend/.env.example frontend/.env.development
cd backend && npm run db:migrate
```

```bash
cd backend && npm run dev     # http://localhost:3000/api
cd frontend && npm run dev    # http://localhost:5173
```

Stack completa em containers:

```bash
cp .env.production.example .env   # preencha os segredos
docker compose up -d --build
```

## Publicando a demo no GitHub Pages

1. Suba o repositório no GitHub.
2. Em **Settings → Pages**, escolha **Source: GitHub Actions**.
3. A cada push na `main`, o workflow `.github/workflows/pages.yml` gera o build
   estático e publica.

Para atualizar os dados fictícios: rode `npm run demo` e, em outro terminal,
`npm run demo:exportar --workspace=backend`. O comando regrava
`frontend/src/demo/dados.json` a partir da demo completa.

## Testes

```bash
cd backend && npm test
cd frontend && npm test -- --run
```

## Documentação

- [docs/API.md](./docs/API.md): referência dos endpoints
- [docs/IMPORTACAO-DOCUMENTOS.md](./docs/IMPORTACAO-DOCUMENTOS.md): como funciona a leitura automática de documentos

## Autor

**Felipe Machado**: [felipano.machado@gmail.com](mailto:felipano.machado@gmail.com)
