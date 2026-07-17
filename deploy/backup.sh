#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT_DIR=$(cd -- "$(dirname -- "$0")/.." && pwd)
COMPOSE_FILE="$ROOT_DIR/deploy/compose.yml"

if [ ! -f "$ROOT_DIR/.env" ]; then
  echo "Missing $ROOT_DIR/.env" >&2
  exit 1
fi

if [ ! -f "$ROOT_DIR/backup.env" ]; then
  echo "Missing $ROOT_DIR/backup.env; copy backup.env.example and fill in the R2 credentials." >&2
  exit 1
fi

compose() {
  docker compose \
    --env-file "$ROOT_DIR/.env" \
    --env-file "$ROOT_DIR/backup.env" \
    -f "$COMPOSE_FILE" \
    "$@"
}

compose --profile tools run --rm backup cat config >/dev/null

echo "Creating an encrypted PostgreSQL backup in Cloudflare R2..."
compose exec -T postgres sh -c \
  'pg_dump --format=custom --no-owner --no-privileges --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"' \
  | compose --profile tools run --rm -T backup backup \
      --stdin \
      --stdin-filename /detailflow-postgres.dump \
      --tag detailflow \
      --tag postgres

echo "Applying backup retention..."
compose --profile tools run --rm backup forget \
  --tag detailflow \
  --keep-daily 7 \
  --keep-weekly 4 \
  --keep-monthly 6 \
  --prune

echo "Checking repository metadata..."
compose --profile tools run --rm backup check

echo "Backup completed successfully."
