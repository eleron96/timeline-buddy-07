#!/usr/bin/env sh
set -eu

DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-postgres}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-${PGPASSWORD:-${POSTGRES_PASSWORD:-}}}"
MIGRATION_CHANGELOG_FILE="${MIGRATION_CHANGELOG_FILE:-liquibase/changelog-master.xml}"
LIQUIBASE_LOG_LEVEL="${LIQUIBASE_LOG_LEVEL:-info}"
MIGRATION_MAX_WAIT_SECONDS="${MIGRATION_MAX_WAIT_SECONDS:-300}"

if [ -z "$DB_PASSWORD" ]; then
  echo "DB password is required (DB_PASSWORD or PGPASSWORD or POSTGRES_PASSWORD)." >&2
  exit 1
fi

if ! printf '%s' "$MIGRATION_MAX_WAIT_SECONDS" | grep -Eq '^[0-9]+$'; then
  echo "MIGRATION_MAX_WAIT_SECONDS must be an integer." >&2
  exit 1
fi

LIQUIBASE_URL="${LIQUIBASE_URL:-jdbc:postgresql://${DB_HOST}:${DB_PORT}/${DB_NAME}}"

run_liquibase() {
  liquibase \
    --url="$LIQUIBASE_URL" \
    --username="$DB_USER" \
    --password="$DB_PASSWORD" \
    --search-path="/liquibase/changelog" \
    --changelog-file="$MIGRATION_CHANGELOG_FILE" \
    --log-level="$LIQUIBASE_LOG_LEVEL" \
    "$@"
}

wait_for_sql_result() {
  sql="$1"
  expected="$2"
  start_ts=$(date +%s)

  while true; do
    if output=$(run_liquibase execute-sql --sql "$sql" 2>/dev/null); then
      if printf '%s\n' "$output" | grep -Eq "^[[:space:]]*${expected}[[:space:]]*\\|"; then
        return 0
      fi
    fi

    now_ts=$(date +%s)
    elapsed=$((now_ts - start_ts))
    if [ "$elapsed" -ge "$MIGRATION_MAX_WAIT_SECONDS" ]; then
      echo "Timed out waiting for SQL condition: $sql" >&2
      return 1
    fi

    sleep 2
  done
}

echo "Waiting for database connection..."
wait_for_sql_result "select 1 as ready" "1"

echo "Waiting for auth.users..."
wait_for_sql_result "select case when exists (select 1 from pg_tables where schemaname='auth' and tablename='users') then 1 else 0 end as ready" "1"

echo "Applying Liquibase migrations..."
run_liquibase update

echo "Liquibase migrations complete."
