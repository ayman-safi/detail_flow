#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT_DIR=$(cd -- "$(dirname -- "$0")/.." && pwd)
COMPOSE_FILE="$ROOT_DIR/deploy/compose.yml"
TARGET_DATABASE=${1:-detailflow_restore_test}
SNAPSHOT=${2:-latest}
ALLOW_PRODUCTION=${3:-}

if [ ! -f "$ROOT_DIR/.env" ] || [ ! -f "$ROOT_DIR/backup.env" ]; then
  echo "Both $ROOT_DIR/.env and $ROOT_DIR/backup.env are required." >&2
  exit 1
fi

case "$TARGET_DATABASE" in
  *[!a-zA-Z0-9_]*)
    echo "The target database name may contain only letters, numbers, and underscores." >&2
    exit 1
    ;;
esac

compose() {
  docker compose \
    --env-file "$ROOT_DIR/.env" \
    --env-file "$ROOT_DIR/backup.env" \
    -f "$COMPOSE_FILE" \
    "$@"
}

PRODUCTION_DATABASE=$(compose exec -T postgres printenv POSTGRES_DB | tr -d '\r')
if [ "$TARGET_DATABASE" = "$PRODUCTION_DATABASE" ]; then
  if [ "$ALLOW_PRODUCTION" != "--allow-production" ]; then
    echo "Refusing to overwrite the production database without --allow-production." >&2
    echo "Use the default restore-test database for a safe restore drill." >&2
    exit 1
  fi

  echo "Creating a fresh backup before the production restore..."
  bash "$ROOT_DIR/deploy/backup.sh"
fi

compose --profile tools run --rm backup cat config >/dev/null

echo "Recreating target database: $TARGET_DATABASE"
compose exec -T postgres sh -c \
  'dropdb --if-exists --force --username="$POSTGRES_USER" "$1" && createdb --username="$POSTGRES_USER" "$1"' \
  sh "$TARGET_DATABASE"

echo "Restoring snapshot $SNAPSHOT into $TARGET_DATABASE..."
compose --profile tools run --rm -T backup dump "$SNAPSHOT" /detailflow-postgres.dump \
  | compose exec -T postgres sh -c \
      'pg_restore --exit-on-error --no-owner --no-privileges --username="$POSTGRES_USER" --dbname="$1"' \
      sh "$TARGET_DATABASE"

echo "Restore completed successfully into $TARGET_DATABASE."
