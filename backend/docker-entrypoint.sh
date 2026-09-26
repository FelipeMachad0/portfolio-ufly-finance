#!/bin/sh
# Aplica as migrations pendentes e então inicia o processo passado no CMD.
#
# `migrate deploy` é o comando próprio para produção: aplica apenas migrations
# já versionadas, nunca gera nem reseta nada (diferente de `migrate dev`).
# É idempotente, então rodar a cada start é seguro.
set -eu

echo "[entrypoint] aplicando migrations..."
npx prisma migrate deploy --schema prisma/schema.prisma

echo "[entrypoint] iniciando: $*"
exec "$@"
