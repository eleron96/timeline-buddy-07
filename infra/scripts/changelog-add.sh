#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$root_dir"

usage() {
  cat <<'EOF'
Usage:
  infra/scripts/changelog-add.sh --ru "..." --en "..." [--type changed]

Options:
  --ru      Russian changelog entry text (required)
  --en      English changelog entry text (required)
  --type    Keep a Changelog section: added|changed|fixed|removed|security (default: changed)

Examples:
  infra/scripts/changelog-add.sh --ru "Исправлен ..." --en "Fixed ..." --type fixed
EOF
}

normalize_section() {
  local raw="${1:-changed}"
  raw="$(printf '%s' "$raw" | tr '[:upper:]' '[:lower:]')"
  case "$raw" in
    added|add) echo "Added" ;;
    changed|change) echo "Changed" ;;
    fixed|fix) echo "Fixed" ;;
    removed|remove) echo "Removed" ;;
    security|secure) echo "Security" ;;
    *)
      echo "Unsupported changelog type: $raw" >&2
      exit 1
      ;;
  esac
}

insert_changelog_entry() {
  local file="$1"
  local section="$2"
  local entry="$3"

  if [[ ! -f "$file" ]]; then
    echo "Missing changelog file: $file" >&2
    exit 1
  fi

  local unreleased_line
  unreleased_line="$(grep -nE '^## \[Unreleased\]' "$file" | head -n1 | cut -d: -f1 || true)"
  if [[ -z "$unreleased_line" ]]; then
    echo "File $file does not contain [Unreleased] section." >&2
    exit 1
  fi

  local next_release_line
  next_release_line="$(awk -v start="$unreleased_line" 'NR > start && /^## \[/ { print NR; exit }' "$file" || true)"

  local tmp_head tmp_body tmp_tail tmp_body_next tmp_out
  tmp_head="$(mktemp)"
  tmp_body="$(mktemp)"
  tmp_tail="$(mktemp)"
  tmp_body_next="$(mktemp)"
  tmp_out="$(mktemp)"

  sed -n "1,${unreleased_line}p" "$file" > "$tmp_head"

  if [[ -n "$next_release_line" ]]; then
    if (( next_release_line > unreleased_line + 1 )); then
      sed -n "$((unreleased_line + 1)),$((next_release_line - 1))p" "$file" > "$tmp_body"
    else
      : > "$tmp_body"
    fi
    sed -n "${next_release_line},\$p" "$file" > "$tmp_tail"
  else
    sed -n "$((unreleased_line + 1)),\$p" "$file" > "$tmp_body"
    : > "$tmp_tail"
  fi

  local heading="### ${section}"
  local bullet="- ${entry}"

  if grep -Fqx -- "$bullet" "$tmp_body"; then
    cp "$tmp_body" "$tmp_body_next"
  elif grep -Fxq -- "$heading" "$tmp_body"; then
    awk -v heading="$heading" -v bullet="$bullet" '
      BEGIN { inserted = 0 }
      {
        if (!inserted && $0 == heading) {
          print $0
          print bullet
          inserted = 1
          next
        }
        print $0
      }
      END {
        if (!inserted) {
          if (NR > 0) print ""
          print heading
          print bullet
        }
      }
    ' "$tmp_body" > "$tmp_body_next"
  else
    awk '
      {
        lines[NR] = $0
        if ($0 ~ /[^[:space:]]/) last = NR
      }
      END {
        if (last == 0) exit
        for (i = 1; i <= last; i += 1) print lines[i]
      }
    ' "$tmp_body" > "$tmp_body_next"

    if [[ -s "$tmp_body_next" ]]; then
      printf "\n\n%s\n%s\n" "$heading" "$bullet" >> "$tmp_body_next"
    else
      printf "\n%s\n%s\n\n" "$heading" "$bullet" > "$tmp_body_next"
    fi
  fi

  cat "$tmp_head" > "$tmp_out"
  cat "$tmp_body_next" >> "$tmp_out"
  cat "$tmp_tail" >> "$tmp_out"
  mv "$tmp_out" "$file"

  rm -f "$tmp_head" "$tmp_body" "$tmp_tail" "$tmp_body_next"
}

ru_entry="${RU:-}"
en_entry="${EN:-}"
type_raw="${TYPE:-changed}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ru)
      ru_entry="${2:-}"
      shift 2
      ;;
    --en)
      en_entry="${2:-}"
      shift 2
      ;;
    --type)
      type_raw="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$ru_entry" || -z "$en_entry" ]]; then
  echo "--ru and --en are required." >&2
  usage
  exit 1
fi

section="$(normalize_section "$type_raw")"

insert_changelog_entry "CHANGELOG.md" "$section" "$ru_entry"
insert_changelog_entry "CHANGELOG.en.md" "$section" "$en_entry"

echo "Added changelog entries to [Unreleased] ($section)."
