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

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c "create table if not exists public.schema_migrations (filename text primary key, applied_at timestamptz not null default now());"

has_workspaces=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "select 1 from information_schema.tables where table_schema='public' and table_name='workspaces'")
has_migrations=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "select 1 from public.schema_migrations limit 1")

if [ "$has_workspaces" = "1" ] && [ -z "$has_migrations" ]; then
  if [ -f /migrations/0001_init.sql ]; then
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c "insert into public.schema_migrations (filename) values ('0001_init.sql') on conflict do nothing;"
  fi
fi

echo "Applying migrations..."
for file in /migrations/*.sql; do
  file_name=$(basename "$file")
  if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "select 1 from public.schema_migrations where filename='${file_name}'" | grep -q 1; then
    echo "Skipping $file_name"
    continue
  fi
  echo "Running $file_name"
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$file"
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c "insert into public.schema_migrations (filename) values ('${file_name}') on conflict do nothing;"
done

echo "Migrations complete."
