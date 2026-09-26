#!/bin/sh
set -eu

TEMPLATE="/config.template.js"
TARGET="/usr/share/nginx/html/config.js"

export VITE_API_URL="${VITE_API_URL:-/api}"
export VITE_APP_NAME="${VITE_APP_NAME:-Ufly Controle Financeiro}"
export VITE_MSAL_CLIENT_ID="${VITE_MSAL_CLIENT_ID:-}"
export VITE_MSAL_AUTHORITY="${VITE_MSAL_AUTHORITY:-}"
export VITE_MSAL_REDIRECT_URI="${VITE_MSAL_REDIRECT_URI:-}"
export VITE_DEMO_MODE="${VITE_DEMO_MODE:-}"

envsubst '${VITE_API_URL} ${VITE_APP_NAME} ${VITE_MSAL_CLIENT_ID} ${VITE_MSAL_AUTHORITY} ${VITE_MSAL_REDIRECT_URI} ${VITE_DEMO_MODE}' \
  < "$TEMPLATE" > "$TARGET"

echo "[entrypoint] config.js gerado:"
cat "$TARGET"
