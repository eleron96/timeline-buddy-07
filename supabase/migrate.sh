#!/usr/bin/env sh
set -e

DB_HOST="db"
DB_PORT="5432"
DB_NAME="postgres"
DB_USER="postgres"

until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1; do
  echo "Waiting for database..."
  sleep 2
done

until psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "select 1 from pg_tables where schemaname='auth' and tablename='users'" | grep -q 1; do
  echo "Waiting for auth schema..."
  sleep 2
done

if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "select 1 from information_schema.tables where table_schema='public' and table_name='workspaces'" | grep -q 1; then
  echo "Schema already applied."
  exit 0
fi

echo "Applying migrations..."
for file in /migrations/*.sql; do
  echo "Running $file"
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$file"
done

echo "Migrations complete."
