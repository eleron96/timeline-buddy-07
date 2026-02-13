#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$root_dir"

compose_file="infra/docker-compose.prod.yml"
env_file=".env"
version_file="VERSION"
release_log_file="infra/releases.log"

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

normalize_bool() {
  local value="${1:-}"
  value="$(printf '%s' "$value" | tr '[:upper:]' '[:lower:]')"
  case "$value" in
    1|true|yes|on)
      echo "true"
      ;;
    *)
      echo "false"
      ;;
  esac
}

POSTGRES_USER="$(get_env_value POSTGRES_USER)"
POSTGRES_DB="$(get_env_value POSTGRES_DB)"
POSTGRES_PASSWORD="$(get_env_value POSTGRES_PASSWORD)"
RESERVE_ADMIN_EMAIL="$(get_env_value RESERVE_ADMIN_EMAIL)"
RESERVE_ADMIN_PASSWORD="$(get_env_value RESERVE_ADMIN_PASSWORD)"
OAUTH2_PROXY_COOKIE_SECRET="$(get_env_value OAUTH2_PROXY_COOKIE_SECRET)"
AUTO_PRE_MIGRATION_BACKUP="$(get_env_value AUTO_PRE_MIGRATION_BACKUP)"
BACKUP_SCHEMAS="$(get_env_value BACKUP_SCHEMAS)"

POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
AUTO_PRE_MIGRATION_BACKUP="$(normalize_bool "${AUTO_PRE_MIGRATION_BACKUP:-true}")"
BACKUP_SCHEMAS="${BACKUP_SCHEMAS:-public,auth,storage}"
backup_path="n/a"

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

if [[ "$AUTO_PRE_MIGRATION_BACKUP" == "true" ]]; then
  until docker compose -f "$compose_file" --env-file "$env_file" exec -T \
    -e PGPASSWORD="$POSTGRES_PASSWORD" db \
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "select 1 from pg_tables where schemaname='auth' and tablename='users'" | grep -q 1; do
    echo "Waiting for auth schema before pre-migration backup..."
    sleep 2
  done

  backup_dir="infra/backups"
  backup_file="pre-migrate-$(date +%Y%m%d-%H%M%S).dump"
  backup_path="$backup_dir/$backup_file"
  mkdir -p "$backup_dir"

  schema_args=()
  IFS=',' read -r -a requested_schemas <<< "$BACKUP_SCHEMAS"
  for schema in "${requested_schemas[@]}"; do
    schema="$(echo "$schema" | xargs)"
    if [[ -z "$schema" ]]; then
      continue
    fi
    if [[ ! "$schema" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]]; then
      echo "Invalid schema name in BACKUP_SCHEMAS: $schema" >&2
      exit 1
    fi
    schema_exists=$(docker compose -f "$compose_file" --env-file "$env_file" exec -T \
      -e PGPASSWORD="$POSTGRES_PASSWORD" db \
      psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "select 1 from pg_namespace where nspname='${schema}'" | tr -d '[:space:]')
    if [[ "$schema_exists" == "1" ]]; then
      schema_args+=("--schema=${schema}")
    else
      echo "Skipping missing schema '$schema' in pre-migration backup."
    fi
  done

  if [[ "${#schema_args[@]}" -eq 0 ]]; then
    echo "No valid schemas resolved for pre-migration backup. Aborting deployment for safety." >&2
    exit 1
  fi

  echo "Creating pre-migration backup: $backup_path"
  docker compose -f "$compose_file" --env-file "$env_file" exec -T \
    -e PGPASSWORD="$POSTGRES_PASSWORD" db \
    pg_dump --format=custom --no-owner "${schema_args[@]}" -U "$POSTGRES_USER" -d "$POSTGRES_DB" > "$backup_path"
  echo "Pre-migration backup created: $backup_path"
else
  echo "AUTO_PRE_MIGRATION_BACKUP=false, skipping pre-migration backup."
fi

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

release_timestamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
release_version="unversioned"
if [[ -f "$version_file" ]]; then
  release_version="$(tr -d '[:space:]' < "$version_file")"
  if [[ -z "$release_version" ]]; then
    release_version="unversioned"
  fi
fi

release_commit="n/a"
if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  release_commit="$(git rev-parse --short HEAD 2>/dev/null || echo n/a)"
fi

mkdir -p "$(dirname "$release_log_file")"
touch "$release_log_file"
printf "%s | %s | %s | %s | %s | %s\n" \
  "$release_timestamp" \
  "$release_version" \
  "$release_commit" \
  "$(whoami)" \
  "$(hostname -s 2>/dev/null || hostname)" \
  "$backup_path" >> "$release_log_file"

echo "Production stack is running."
echo "Frontend: http://localhost:5173"
echo "Supabase Gateway health: http://localhost:8080/health"
echo "Supabase Auth health: http://localhost:8080/auth/v1/health"
echo "Keycloak: http://localhost:8081"
echo "Login as reserve super admin: $RESERVE_ADMIN_EMAIL"
echo "Release log updated: $release_log_file"
