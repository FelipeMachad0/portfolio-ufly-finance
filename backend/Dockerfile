# Backend (Express + Prisma).
#
# IMPORTANTE: o contexto de build é a RAIZ do repositório, não backend/, porque
# o backend depende do workspace @ufly/shared:
#   docker build -f backend/Dockerfile -t ufly-finance-backend .
#
# Build e runtime usam a MESMA imagem base de propósito: o schema.prisma não
# declara binaryTargets (usa "native"), então o engine gerado no build precisa
# casar com a libc/arquitetura de quem roda. Trocar a base de um dos estágios
# quebra o Prisma em runtime.

FROM node:22-alpine AS build
WORKDIR /app

# Manifests primeiro para aproveitar o cache: só reinstala se as deps mudarem.
# O package-lock referencia todos os workspaces, então os três manifests são
# necessários mesmo que este estágio só compile backend e shared.
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# --ignore-scripts: o postinstall do backend roda `prisma generate`, que precisa
# do schema — e ele ainda não foi copiado. O generate acontece no build abaixo.
RUN npm ci --ignore-scripts

COPY packages/shared ./packages/shared
COPY backend ./backend

# `npm run build` do backend já faz `prisma generate && tsc`.
RUN npm run build --workspace=@ufly/shared \
 && npm run build --workspace=backend


FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# tini: sem um init, o Node roda como PID 1 e ignora SIGTERM — o container
# demoraria os 10s do timeout do Docker para parar em cada deploy.
RUN apk add --no-cache tini

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=build /app/backend/dist ./backend/dist
# O schema vai para a imagem porque o entrypoint roda `prisma migrate deploy`.
COPY --from=build /app/backend/prisma ./backend/prisma
COPY backend/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Uploads de notas/comprovantes: diretório existe e pertence ao usuário node
# (em produção deve ser um volume, senão os anexos morrem com o container).
RUN mkdir -p /app/backend/uploads && chown -R node:node /app/backend/uploads

USER node
WORKDIR /app/backend
EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]
