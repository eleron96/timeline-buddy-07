#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
version_file="$root_dir/VERSION"

usage() {
  echo "Usage: $0 <major|minor|patch|set X.Y.Z>" >&2
  exit 1
}

if [[ ! -f "$version_file" ]]; then
  echo "Missing VERSION file: $version_file" >&2
  exit 1
fi

current="$(tr -d '[:space:]' < "$version_file")"
if [[ ! "$current" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
  echo "Invalid VERSION format: $current" >&2
  exit 1
fi

major="${BASH_REMATCH[1]}"
minor="${BASH_REMATCH[2]}"
patch="${BASH_REMATCH[3]}"

if [[ $# -lt 1 ]]; then
  usage
fi

case "$1" in
  major)
    major=$((major + 1))
    minor=0
    patch=0
    ;;
  minor)
    minor=$((minor + 1))
    patch=0
    ;;
  patch)
    patch=$((patch + 1))
    ;;
  set)
    if [[ $# -ne 2 ]]; then
      usage
    fi
    if [[ ! "$2" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
      echo "Invalid version: $2" >&2
      exit 1
    fi
    echo "$2" > "$version_file"
    echo "VERSION: $current -> $2"
    exit 0
    ;;
  *)
    usage
    ;;
esac

next="${major}.${minor}.${patch}"
echo "$next" > "$version_file"
echo "VERSION: $current -> $next"
