#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root_dir"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required. Please install Docker Desktop." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker is not running. Start Docker Desktop and retry." >&2
  exit 1
fi

if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI not found. Falling back to docker-compose." >&2
  exec ./scripts/dev-compose.sh
fi

supabase start

node - <<'NODE'
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

let statusRaw = '';
try {
  statusRaw = execSync('supabase status --output json', { encoding: 'utf8' });
} catch (error) {
  console.error('Failed to read supabase status.');
  process.exit(1);
}

let status = {};
try {
  status = JSON.parse(statusRaw);
} catch (error) {
  console.error('Failed to parse supabase status JSON.');
  process.exit(1);
}

const url = status.API_URL || status.api_url || status.apiUrl;
const anon = status.ANON_KEY || status.anon_key || status.anonKey;
const service = status.SERVICE_ROLE_KEY || status.service_role_key || status.serviceRoleKey;

if (!url || !anon) {
  console.error('Supabase status output is missing API_URL or ANON_KEY.');
  process.exit(1);
}

const env = `VITE_SUPABASE_URL=${url}\nVITE_SUPABASE_ANON_KEY=${anon}\n`;
fs.writeFileSync(path.join(process.cwd(), '.env.local'), env);
if (service) {
  const functionsEnv = `SUPABASE_URL=${url}\nSUPABASE_SERVICE_ROLE_KEY=${service}\nAPP_URL=http://localhost:5173\n`;
  fs.writeFileSync(path.join(process.cwd(), '.supabase-functions.env'), functionsEnv);
}
console.log('Updated .env.local');
NODE

if [[ -f .supabase-functions.env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .supabase-functions.env
  set +a
fi

supabase functions serve invite > .supabase-functions.log 2>&1 &
functions_pid=$!

cleanup() {
  if kill -0 "$functions_pid" >/dev/null 2>&1; then
    kill "$functions_pid"
  fi
}
trap cleanup EXIT

npm run dev
