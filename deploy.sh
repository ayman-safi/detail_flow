#!/bin/bash
set -euo pipefail

: "${IMAGE_REPOSITORY:?Set IMAGE_REPOSITORY, for example ghcr.io/owner/repo}"
export IMAGE_TAG="${IMAGE_TAG:-latest}"

echo "Pulling ${IMAGE_REPOSITORY}-api:${IMAGE_TAG} and ${IMAGE_REPOSITORY}-web:${IMAGE_TAG}..."
docker compose -f docker-compose.prod.yml pull postgres caddy api web

echo "Starting database..."
docker compose -f docker-compose.prod.yml up -d postgres

echo "Running DB migrations..."
docker compose -f docker-compose.prod.yml run --rm migrator

echo "Starting app services..."
docker compose -f docker-compose.prod.yml up -d --remove-orphans api web caddy
docker image prune -f

echo "Done. Services:"
docker compose -f docker-compose.prod.yml ps
