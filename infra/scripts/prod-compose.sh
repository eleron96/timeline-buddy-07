#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$root_dir"

compose_file="infra/docker-compose.prod.yml"
env_file=".env"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required. Please install Docker." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker is not running. Start Docker and retry." >&2
  exit 1
fi

if [[ ! -f "$env_file" ]]; then
  echo "Missing .env file in project root." >&2
  echo "Create it from .env.example and fill the values." >&2
  exit 1
fi

get_env_value() {
  local key="$1"
  local line
  line=$(grep -E "^${key}=" "$env_file" | head -n1 || true)
  echo "${line#*=}"
}

set_env_value() {
  local key="$1"
  local value="$2"
  local tmp_file
  tmp_file="$(mktemp)"
  awk -F= -v key="$key" -v value="$value" '
    BEGIN { updated = 0 }
    $1 == key {
      print key "=" value
      updated = 1
      next
    }
    { print $0 }
    END {
      if (!updated) print key "=" value
    }
  ' "$env_file" > "$tmp_file"
  mv "$tmp_file" "$env_file"
}

POSTGRES_USER="$(get_env_value POSTGRES_USER)"
POSTGRES_DB="$(get_env_value POSTGRES_DB)"
POSTGRES_PASSWORD="$(get_env_value POSTGRES_PASSWORD)"
RESERVE_ADMIN_EMAIL="$(get_env_value RESERVE_ADMIN_EMAIL)"
RESERVE_ADMIN_PASSWORD="$(get_env_value RESERVE_ADMIN_PASSWORD)"
OAUTH2_PROXY_COOKIE_SECRET="$(get_env_value OAUTH2_PROXY_COOKIE_SECRET)"

POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"

if [[ -z "$RESERVE_ADMIN_EMAIL" || -z "$RESERVE_ADMIN_PASSWORD" ]]; then
  echo "RESERVE_ADMIN_EMAIL and RESERVE_ADMIN_PASSWORD are required for invite-only production mode." >&2
  exit 1
fi

if [[ -z "$OAUTH2_PROXY_COOKIE_SECRET" ]]; then
  if command -v openssl >/dev/null 2>&1; then
    OAUTH2_PROXY_COOKIE_SECRET="$(openssl rand -base64 32)"
  elif command -v node >/dev/null 2>&1; then
    OAUTH2_PROXY_COOKIE_SECRET="$(node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64'))")"
  else
    echo "OAUTH2_PROXY_COOKIE_SECRET is missing and neither openssl nor node is available to generate it." >&2
    exit 1
  fi
  set_env_value "OAUTH2_PROXY_COOKIE_SECRET" "$OAUTH2_PROXY_COOKIE_SECRET"
  echo "Generated OAUTH2_PROXY_COOKIE_SECRET in $env_file"
fi

export COMPOSE_MENU=0

docker compose -f "$compose_file" --env-file "$env_file" up -d db

until docker compose -f "$compose_file" --env-file "$env_file" exec -T \
  -e PGPASSWORD="$POSTGRES_PASSWORD" db \
  pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; do
  echo "Waiting for database..."
  sleep 2
done

docker compose -f "$compose_file" --env-file "$env_file" up -d keycloak-db keycloak auth rest functions backup gateway
docker compose -f "$compose_file" --env-file "$env_file" restart gateway >/dev/null 2>&1 || true

docker compose -f "$compose_file" --env-file "$env_file" run --rm migrate

if command -v curl >/dev/null 2>&1; then
  bootstrap_url="http://localhost:8080/functions/v1/admin"
  bootstrap_payload='{"action":"bootstrap.sync"}'
  bootstrap_ok=0
  for attempt in {1..20}; do
    status_code=$(curl -sS -o /dev/null -w "%{http_code}" \
      -X POST \
      -H "Content-Type: application/json" \
      -d "$bootstrap_payload" \
      "$bootstrap_url" || true)
    if [[ "$status_code" == "200" ]]; then
      echo "Keycloak sync bootstrap completed (HTTP $status_code)."
      bootstrap_ok=1
      break
    fi
    sleep 2
  done

  if [[ "$bootstrap_ok" -ne 1 ]]; then
    echo "Warning: could not confirm Keycloak sync bootstrap. Check functions logs." >&2
  fi
else
  echo "Warning: curl is not installed, skipping Keycloak sync bootstrap request." >&2
fi

docker compose -f "$compose_file" --env-file "$env_file" up -d --build web oauth2-proxy

echo "Production stack is running."
echo "Frontend: http://localhost:5173"
echo "Supabase Gateway health: http://localhost:8080/health"
echo "Supabase Auth health: http://localhost:8080/auth/v1/health"
echo "Keycloak: http://localhost:8081"
echo "Login as reserve super admin: $RESERVE_ADMIN_EMAIL"
