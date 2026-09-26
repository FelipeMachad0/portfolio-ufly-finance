-- CreateTable
CREATE TABLE "type_field_schemas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "tipo" VARCHAR(20) NOT NULL,
    "fields_schema" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "type_field_schemas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "type_field_schemas_user_id_tipo_key" ON "type_field_schemas"("user_id", "tipo");

-- AddForeignKey
ALTER TABLE "type_field_schemas" ADD CONSTRAINT "type_field_schemas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

