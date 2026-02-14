#!/usr/bin/env bash
set -euo pipefail

if [[ -n "${BASH_SOURCE[0]:-}" && -f "${BASH_SOURCE[0]}" ]]; then
  root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
  cd "$root_dir"
fi

env_file="${1:-.env}"

if [[ ! -f "$env_file" ]]; then
  echo "Missing env file: $env_file" >&2
  exit 1
fi

get_env_value() {
  local key="$1"
  local line
  line="$(grep -E "^${key}=" "$env_file" | head -n1 || true)"
  echo "${line#*=}"
}

fail() {
  echo "$1" >&2
  exit 1
}

is_forbidden_secret() {
  local value="$1"
  case "$value" in
    timeline-supabase-dev-secret-change-me|timeline-supabase-local-dev-secret)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

GOTRUE_EXTERNAL_KEYCLOAK_CLIENT_ID="$(get_env_value GOTRUE_EXTERNAL_KEYCLOAK_CLIENT_ID)"
GOTRUE_EXTERNAL_KEYCLOAK_SECRET="$(get_env_value GOTRUE_EXTERNAL_KEYCLOAK_SECRET)"
OAUTH2_PROXY_CLIENT_ID="$(get_env_value OAUTH2_PROXY_CLIENT_ID)"
OAUTH2_PROXY_CLIENT_SECRET="$(get_env_value OAUTH2_PROXY_CLIENT_SECRET)"

[[ -n "$GOTRUE_EXTERNAL_KEYCLOAK_CLIENT_ID" ]] || fail "GOTRUE_EXTERNAL_KEYCLOAK_CLIENT_ID is required in $env_file"
[[ -n "$GOTRUE_EXTERNAL_KEYCLOAK_SECRET" ]] || fail "GOTRUE_EXTERNAL_KEYCLOAK_SECRET is required in $env_file"
[[ -n "$OAUTH2_PROXY_CLIENT_ID" ]] || fail "OAUTH2_PROXY_CLIENT_ID is required in $env_file"
[[ -n "$OAUTH2_PROXY_CLIENT_SECRET" ]] || fail "OAUTH2_PROXY_CLIENT_SECRET is required in $env_file"

if is_forbidden_secret "$GOTRUE_EXTERNAL_KEYCLOAK_SECRET"; then
  fail "GOTRUE_EXTERNAL_KEYCLOAK_SECRET uses forbidden dev/default value."
fi
if is_forbidden_secret "$OAUTH2_PROXY_CLIENT_SECRET"; then
  fail "OAUTH2_PROXY_CLIENT_SECRET uses forbidden dev/default value."
fi

if (( ${#GOTRUE_EXTERNAL_KEYCLOAK_SECRET} < 24 )); then
  fail "GOTRUE_EXTERNAL_KEYCLOAK_SECRET is too short (<24)."
fi
if (( ${#OAUTH2_PROXY_CLIENT_SECRET} < 24 )); then
  fail "OAUTH2_PROXY_CLIENT_SECRET is too short (<24)."
fi

if [[ "$GOTRUE_EXTERNAL_KEYCLOAK_CLIENT_ID" == "$OAUTH2_PROXY_CLIENT_ID" && "$GOTRUE_EXTERNAL_KEYCLOAK_SECRET" != "$OAUTH2_PROXY_CLIENT_SECRET" ]]; then
  fail "Client IDs are equal but secrets differ. For one Keycloak client they must match."
fi

echo "Prod OIDC secrets check passed."
