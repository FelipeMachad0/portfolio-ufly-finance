-- Apagar uma pessoa não pode apagar os dados da empresa.
--
-- Todas as oito tabelas de negócio referenciavam `users` com ON DELETE CASCADE.
-- Na prática, remover uma única linha de `users` levava junto, em silêncio,
-- lançamentos, orçamentos, categorias, clientes, projetos e contas — ou seja, o
-- acervo inteiro. Isso vem de uma versão anterior do produto, em que
-- cada usuário tinha os próprios dados. Hoje os dados são da plataforma — todo
-- mundo vê tudo — e `user_id` virou metadado de quem cadastrou. Um lançamento
-- contábil não pode depender de quem continua na empresa.
--
-- Duas regras diferentes, de propósito:
--
--   transactions -> SET NULL
--     É o livro de lançamentos: precisa sobreviver sozinho. A coluna vira
--     opcional e, se o usuário for removido, o lançamento permanece e apenas
--     perde a atribuição de quem o cadastrou.
--
--   demais tabelas -> RESTRICT
--     Quatro delas (budgets, categories, cost_center_budgets,
--     type_field_schemas) têm índice único que INCLUI user_id. Anular a coluna
--     faria a unicidade deixar de valer em silêncio, porque o Postgres trata
--     NULLs como distintos entre si — dariam duas categorias "Impostos". Com
--     RESTRICT o banco recusa apagar um usuário que ainda tenha dados, forçando
--     uma reatribuição consciente em vez de destruir por engano.

-- ── transactions: o lançamento sobrevive ao usuário ─────────────────────────
ALTER TABLE "transactions" ALTER COLUMN "user_id" DROP NOT NULL;

ALTER TABLE "transactions" DROP CONSTRAINT "transactions_user_id_fkey";
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;

-- ── demais tabelas: o banco recusa apagar usuário que ainda tem dados ───────
ALTER TABLE "accounts" DROP CONSTRAINT "accounts_user_id_fkey";
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "budgets" DROP CONSTRAINT "budgets_user_id_fkey";
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "categories" DROP CONSTRAINT "categories_user_id_fkey";
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "clientes" DROP CONSTRAINT "clientes_user_id_fkey";
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "cost_center_budgets" DROP CONSTRAINT "cost_center_budgets_user_id_fkey";
ALTER TABLE "cost_center_budgets" ADD CONSTRAINT "cost_center_budgets_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "projetos" DROP CONSTRAINT "projetos_user_id_fkey";
ALTER TABLE "projetos" ADD CONSTRAINT "projetos_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "type_field_schemas" DROP CONSTRAINT "type_field_schemas_user_id_fkey";
ALTER TABLE "type_field_schemas" ADD CONSTRAINT "type_field_schemas_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;
