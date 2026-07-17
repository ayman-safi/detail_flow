#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
COMPOSE_FILE="$ROOT_DIR/deploy/compose.yml"

if [ ! -f "$ROOT_DIR/.env" ]; then
  echo "Missing $ROOT_DIR/.env" >&2
  exit 1
fi

if [ ! -f "$ROOT_DIR/backup.env" ]; then
  echo "Missing $ROOT_DIR/backup.env; copy backup.env.example and fill in the R2 credentials." >&2
  exit 1
fi

docker compose \
  --env-file "$ROOT_DIR/.env" \
  --env-file "$ROOT_DIR/backup.env" \
  -f "$COMPOSE_FILE" \
  --profile tools \
  run --rm backup init

echo "The encrypted Restic repository is initialized. Keep RESTIC_PASSWORD in a password manager."
