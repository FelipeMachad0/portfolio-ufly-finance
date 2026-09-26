# Frontend (Vite + React) servido por nginx.
#
# IMPORTANTE: o contexto de build é a RAIZ do repositório, não frontend/, porque
# o frontend depende do workspace @ufly/shared:
#   docker build -f frontend/Dockerfile -t ufly-finance-frontend .
#
# A imagem é a mesma para qualquer ambiente ("build once, deploy many"): nada de
# URL de API é embutido no bundle. O config.js é regerado no startup a partir das
# variáveis de ambiente (ver docker-entrypoint.d/40-render-config.sh).

FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# --ignore-scripts: evita o postinstall do backend (prisma generate), que é
# irrelevante para o bundle e falharia sem o schema.
RUN npm ci --ignore-scripts

COPY packages/shared ./packages/shared
COPY frontend ./frontend

# shared primeiro: o `tsc` do frontend consome os tipos de @ufly/shared/dist.
RUN npm run build --workspace=@ufly/shared \
 && npm run build --workspace=frontend


FROM nginx:1.27-alpine AS runtime

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY frontend/config.template.js /config.template.js
COPY frontend/docker-entrypoint.d/40-render-config.sh /docker-entrypoint.d/40-render-config.sh
# chmod explícito: o bit de execução não sobrevive ao checkout no Windows, e o
# entrypoint do nginx ignora silenciosamente scripts sem permissão.
RUN chmod +x /docker-entrypoint.d/40-render-config.sh

COPY --from=build /app/frontend/dist /usr/share/nginx/html

EXPOSE 80
