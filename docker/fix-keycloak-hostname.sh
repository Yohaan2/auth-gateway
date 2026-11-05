#!/usr/bin/env bash
# Corrige frontend_url en la DB de Keycloak cuando sigue redirigiendo a un host/IP viejo.
# Uso (desde la raíz del repo):
#   bash docker/fix-keycloak-hostname.sh
# Opcional: OLD_HOST=10.0.10.16 bash docker/fix-keycloak-hostname.sh

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/.env}"
CONTAINER="${POSTGRES_CONTAINER:-auth-optrax-postgres}"
OLD_HOST="${OLD_HOST:-10.0.10.16}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "No se encontró $ENV_FILE" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

: "${POSTGRES_USER:?POSTGRES_USER en .env}"
: "${KEYCLOAK_URL:?KEYCLOAK_URL en .env}"

KC_URL="${KEYCLOAK_URL//\'/''}"

echo "realm.frontend_url → $KC_URL (quitar referencias a $OLD_HOST)"

docker exec "$CONTAINER" psql -U "$POSTGRES_USER" -d keycloak -v ON_ERROR_STOP=1 <<SQL
UPDATE realm
SET frontend_url = '${KC_URL}'
WHERE frontend_url IS NOT NULL AND frontend_url LIKE '%${OLD_HOST}%';

UPDATE realm
SET frontend_url = '${KC_URL}'
WHERE name IN ('master', 'optrax-realm')
  AND (frontend_url IS NULL OR frontend_url = '' OR frontend_url LIKE '%${OLD_HOST}%');

SELECT name, frontend_url FROM realm;

-- HTTP sin TLS: evita que el admin exija https (master por defecto).
UPDATE realm SET ssl_required = 'NONE' WHERE name IN ('master', 'optrax-realm');
SELECT name, ssl_required FROM realm;
SQL

echo "Reinicia: docker restart auth-optrax-keycloak auth-optrax-nginx"
