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

POSTGRES_USER="$(get_env_value POSTGRES_USER)"
POSTGRES_DB="$(get_env_value POSTGRES_DB)"
POSTGRES_PASSWORD="$(get_env_value POSTGRES_PASSWORD)"
RESERVE_ADMIN_EMAIL="$(get_env_value RESERVE_ADMIN_EMAIL)"
RESERVE_ADMIN_PASSWORD="$(get_env_value RESERVE_ADMIN_PASSWORD)"

POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"

if [[ -z "$RESERVE_ADMIN_EMAIL" || -z "$RESERVE_ADMIN_PASSWORD" ]]; then
  echo "RESERVE_ADMIN_EMAIL and RESERVE_ADMIN_PASSWORD are required for invite-only production mode." >&2
  exit 1
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
  bootstrap_payload='{"action":"bootstrap.reserveAdmin"}'
  bootstrap_ok=0
  for attempt in {1..20}; do
    status_code=$(curl -sS -o /dev/null -w "%{http_code}" \
      -X POST \
      -H "Content-Type: application/json" \
      -d "$bootstrap_payload" \
      "$bootstrap_url" || true)
    if [[ "$status_code" == "401" || "$status_code" == "400" || "$status_code" == "403" ]]; then
      echo "Reserve super admin bootstrap request accepted (HTTP $status_code)."
      bootstrap_ok=1
      break
    fi
    sleep 2
  done

  if [[ "$bootstrap_ok" -ne 1 ]]; then
    echo "Warning: could not confirm reserve super admin bootstrap. Check functions logs." >&2
  fi
else
  echo "Warning: curl is not installed, skipping reserve super admin bootstrap request." >&2
fi

docker compose -f "$compose_file" --env-file "$env_file" up -d --build web

echo "Production stack is running."
echo "Frontend: http://localhost:5173"
echo "Supabase Gateway health: http://localhost:8080/health"
echo "Supabase Auth health: http://localhost:8080/auth/v1/health"
echo "Keycloak: http://localhost:8081"
echo "Login as reserve super admin: $RESERVE_ADMIN_EMAIL"
