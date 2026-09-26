-- Mapeamento grupo de segurança do Entra ID -> papel desta aplicação.
--
-- É assim que o acesso passa a ser concedido: a TI adiciona a pessoa no grupo do
-- Entra e ela entra com o papel correspondente, sem ninguém cadastrar usuário
-- aqui. O grupo é a lista de acesso.
--
-- Por que uma tabela e não variável de ambiente: os Object ID dos grupos mudam
-- por ambiente (o tenant de produção e um eventual tenant de teste têm GUIDs
-- diferentes), a lista cresce quando um papel novo aparece, e assim dá para
-- auditar quem alterou o mapeamento sem redeploy.

-- CreateTable
CREATE TABLE "entra_group_mapping" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "group_object_id" VARCHAR(36) NOT NULL,
    "group_name" VARCHAR(200) NOT NULL,
    "role" VARCHAR(30) NOT NULL,
    -- Ordem de precedência quando a pessoa está em mais de um grupo: ganha o
    -- menor valor. Sem isto, quem estivesse em GestorGeral e Usuario receberia
    -- um papel imprevisível, dependente da ordem da claim.
    "precedence" INTEGER NOT NULL DEFAULT 100,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entra_group_mapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "entra_group_mapping_group_object_id_key" ON "entra_group_mapping"("group_object_id");

-- Mapeamento grupo do Entra -> papel. Os object ids abaixo são PLACEHOLDERS:
-- substitua pelos ids reais dos grupos criados no seu tenant (ou edite a tabela
-- entra_group_mapping depois de aplicar as migrations).
--
-- GestorDepartamento existe como papel puro: o vínculo com o que a pessoa
-- gerencia NÃO vem do Entra, mora em cost_center_budgets.gestor_user_id. A
-- aplicação organiza por centro de custo, não por departamento, e centros de
-- custo são criados pelos usuários — um grupo por centro no Entra exigiria criar
-- grupo a cada cadastro.
INSERT INTO "entra_group_mapping" ("group_object_id", "group_name", "role", "precedence") VALUES
    ('abcdef10-0000-4000-8000-000000000010', 'Financeiro-GestorGeral',        'GESTOR_GERAL',        10),
    ('abcdef20-0000-4000-8000-000000000020', 'Financeiro-GestorDepartamento', 'GESTOR_DEPARTAMENTO', 20),
    ('abcdef30-0000-4000-8000-000000000030', 'Financeiro-Auditor',            'AUDITOR',             30),
    ('abcdef40-0000-4000-8000-000000000040', 'Financeiro-Usuario',            'USUARIO',             40)
ON CONFLICT ("group_object_id") DO NOTHING;
