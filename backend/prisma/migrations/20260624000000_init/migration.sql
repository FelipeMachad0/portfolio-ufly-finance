-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "entra_id" VARCHAR(255),
    "avatar_url" VARCHAR(500),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "role" VARCHAR(30) NOT NULL DEFAULT 'USUARIO',
    "status" VARCHAR(20) NOT NULL DEFAULT 'ATIVO',
    "last_login" TIMESTAMP(6),
    "deleted_at" TIMESTAMP(6),
    "password_hash" VARCHAR(255),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "balance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL DEFAULT 'BRL',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(6),

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "date" DATE NOT NULL,
    "category_id" UUID,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(6),
    "status" VARCHAR(20) NOT NULL DEFAULT 'completed',
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evento_auditoria" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID,
    "tipo_evento" VARCHAR(100) NOT NULL,
    "entidade" VARCHAR(100) NOT NULL,
    "entidade_id" UUID,
    "payload_antes" JSONB,
    "payload_depois" JSONB,
    "criado_em" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evento_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "limit_amount" DECIMAL(15,2) NOT NULL,
    "period" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(6),

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "color" VARCHAR(7) NOT NULL DEFAULT '#08133E',
    "icon" VARCHAR(50),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(6),
    "fields_schema" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_center_budgets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "cost_center" VARCHAR(50) NOT NULL,
    "label" VARCHAR(200),
    "monthly_amount" DECIMAL(15,2) NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(6),
    "gestor_user_id" UUID,

    CONSTRAINT "cost_center_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_entra_id_key" ON "users"("entra_id");

-- CreateIndex
CREATE INDEX "idx_users_deleted_at" ON "users"("deleted_at");

-- CreateIndex
CREATE INDEX "idx_users_email" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_users_entra_id" ON "users"("entra_id");

-- CreateIndex
CREATE INDEX "idx_users_role" ON "users"("role");

-- CreateIndex
CREATE INDEX "idx_users_status" ON "users"("status");

-- CreateIndex
CREATE INDEX "idx_accounts_user_id" ON "accounts"("user_id");

-- CreateIndex
CREATE INDEX "idx_transactions_account_id" ON "transactions"("account_id");

-- CreateIndex
CREATE INDEX "idx_transactions_date" ON "transactions"("date");

-- CreateIndex
CREATE INDEX "idx_transactions_metadata_gin" ON "transactions" USING GIN ("metadata");

-- CreateIndex
CREATE INDEX "idx_transactions_user_id" ON "transactions"("user_id");

-- CreateIndex
CREATE INDEX "idx_auditoria_criado_em" ON "evento_auditoria"("criado_em");

-- CreateIndex
CREATE INDEX "idx_auditoria_tipo_evento" ON "evento_auditoria"("tipo_evento");

-- CreateIndex
CREATE INDEX "idx_auditoria_usuario_id" ON "evento_auditoria"("usuario_id");

-- CreateIndex
CREATE INDEX "idx_budgets_category_id" ON "budgets"("category_id");

-- CreateIndex
CREATE INDEX "idx_budgets_user_id" ON "budgets"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "budgets_user_id_category_id_period_key" ON "budgets"("user_id", "category_id", "period");

-- CreateIndex
CREATE INDEX "idx_categories_type" ON "categories"("type");

-- CreateIndex
CREATE INDEX "idx_categories_user_id" ON "categories"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_user_id_name_type_key" ON "categories"("user_id", "name", "type");

-- CreateIndex
CREATE INDEX "idx_ccb_cost_center" ON "cost_center_budgets"("cost_center");

-- CreateIndex
CREATE INDEX "idx_ccb_gestor" ON "cost_center_budgets"("gestor_user_id");

-- CreateIndex
CREATE INDEX "idx_ccb_user_id" ON "cost_center_budgets"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "cost_center_budgets_user_id_cost_center_key" ON "cost_center_budgets"("user_id", "cost_center");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "evento_auditoria" ADD CONSTRAINT "evento_auditoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cost_center_budgets" ADD CONSTRAINT "cost_center_budgets_gestor_user_id_fkey" FOREIGN KEY ("gestor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cost_center_budgets" ADD CONSTRAINT "cost_center_budgets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;


-- CHECK constraints (idênticos ao banco original).
ALTER TABLE "users" ADD CONSTRAINT "users_role_check" CHECK ("role" IN ('USUARIO', 'GESTOR_DEPARTAMENTO', 'GESTOR_GERAL', 'AUDITOR'));
ALTER TABLE "users" ADD CONSTRAINT "users_status_check" CHECK ("status" IN ('ATIVO', 'INATIVO'));
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_type_check" CHECK ("type" IN ('bank', 'credit_card', 'wallet'));
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_amount_check" CHECK ("amount" > 0);
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_type_check" CHECK ("type" IN ('income', 'expense', 'transfer'));
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_status_check" CHECK ("status" IN ('pending', 'completed', 'cancelled'));
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_limit_amount_check" CHECK ("limit_amount" > 0);
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_period_check" CHECK ("period" IN ('monthly', 'yearly'));
ALTER TABLE "categories" ADD CONSTRAINT "categories_type_check" CHECK ("type" IN ('income', 'expense'));
ALTER TABLE "cost_center_budgets" ADD CONSTRAINT "cost_center_budgets_monthly_amount_check" CHECK ("monthly_amount" >= 0);
