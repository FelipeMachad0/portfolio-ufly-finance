# API

Base: `/api`. Todas as rotas, exceto `/auth/*` e `/health`, exigem
`Authorization: Bearer <jwt>`. Os erros vêm como `{ "error": "mensagem" }`.

Os schemas de entrada ficam em `packages/shared/src/schemas` (Zod) e são os
mesmos que o frontend usa para validar os formulários.

## Autenticação

| Método | Rota | Descrição |
|---|---|---|
| POST | `/auth/entra/callback` | Troca o `idToken` do Entra ID (`{ idToken }`) pelo JWT da aplicação. O token é verificado no backend (assinatura, issuer, audience) e o papel vem dos grupos do Entra |
| POST | `/auth/demo` | Entra como o usuário fictício. **Só existe com `DEMO_MODE=true`** |
| POST | `/auth/login` | Break-glass por senha (`{ email, password }`), sem tela; só para usuários com `password_hash` |
| POST | `/auth/logout` | Registra a saída |

Resposta dos logins: `{ token, user: { id, email, name, role } }`.

## Cadastros

| Recurso | Rotas |
|---|---|
| Contas | `GET/POST /accounts`, `GET/PUT/DELETE /accounts/:id` |
| Categorias | `GET/POST /categories` (`?type=income\|expense`), `GET/PUT/DELETE /categories/:id` |
| Clientes | `GET/POST /clientes`, `GET/PUT/DELETE /clientes/:id` (cada cliente tem várias empresas/CNPJs) |
| Projetos | `GET/POST /projetos`, `GET/PUT/DELETE /projetos/:id` |
| Orçamentos por categoria | `GET/POST /budgets`, `PUT/DELETE /budgets/:id` |
| Centros de custo | `GET/POST /cost-centers` (upsert pelo código), `DELETE /cost-centers/:id`, `GET /cost-centers/comparison` (previsto x realizado no período) |
| Campos por tipo | `GET /type-fields`, `PUT /type-fields/:tipo` (campos padrão de Entrada/Saída) |
| Usuários | `GET /users/me`, `GET/POST /users`, `GET/PUT/DELETE /users/:id` |

## Lançamentos

| Método | Rota | Descrição |
|---|---|---|
| GET | `/transactions` | Paginado. Filtros: `accountId`, `categoryId`, `type`, `status`, `startDate`, `endDate`, `search`, `page`, `limit` |
| POST | `/transactions` | Cria; ajusta o saldo da conta quando `status = completed` |
| GET/PUT/DELETE | `/transactions/:id` | Consulta, edita e exclui (soft delete) |

`metadata` guarda os campos dinâmicos da categoria, indexados pela `key` de
cada campo.

## Relatórios

Todos aceitam `startDate` e `endDate` (ISO). Sem os dois, o período é o
histórico inteiro.

| Rota | Retorno |
|---|---|
| `GET /reports/summary` | Receita, despesa, saldo e quantidade de lançamentos |
| `GET /reports/revenue-vs-expense` | Série por mês ou dia (`granularity=month\|day`) |
| `GET /reports/expenses-by-category` | Despesa total por categoria |
| `GET /reports/revenue-by-client` | Receita por cliente (`metadata.cliente`) |
| `GET /reports/dre` | DRE mensal por seção (receita, deduções, CPV, despesas...) |

## Importação e exportação

| Método | Rota | Descrição |
|---|---|---|
| POST | `/importacoes` | Envia até 5 documentos (multipart `files`) para leitura em segundo plano. Responde `202` |
| GET | `/importacoes` | Bandeja do usuário: leituras na fila, prontas ou com falha |
| POST | `/importacoes/:id/confirmar` | Vincula o lançamento criado a partir da leitura |
| DELETE | `/importacoes/:id` | Descarta a leitura |
| POST | `/notas/importar` | Lê um documento (multipart `file`) na hora e devolve `{ nota, extraction }` |
| POST | `/import/preview` | Prévia de planilha CSV/XLSX, com detecção de duplicatas |
| POST | `/import/confirm` | Importa as linhas confirmadas |
| GET | `/export/transactions` | XLSX dos lançamentos |
| GET | `/export/report` | XLSX do relatório do período |
| GET | `/export/completo` | Planilha de controle completa |
| POST | `/uploads` | Anexa um arquivo (multipart `file`) |
| GET | `/uploads/:id` | Baixa ou visualiza o anexo |

Detalhes da leitura automática de documentos: [IMPORTACAO-DOCUMENTOS.md](./IMPORTACAO-DOCUMENTOS.md).

## Saúde

`GET /health` → `{ status, db, timestamp }`, sem autenticação.
