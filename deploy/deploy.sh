#!/usr/bin/env bash
set -Eeuo pipefail

: "${VPS_APP_DIR:=/opt/detailflow}"
: "${IMAGE_REPOSITORY:?Set IMAGE_REPOSITORY}"
: "${IMAGE_TAG:?Set IMAGE_TAG}"
: "${APP_PORT:=8080}"

if [[ ! "$APP_PORT" =~ ^[0-9]+$ ]]; then
  echo "APP_PORT must be numeric." >&2
  exit 1
fi

cd "$VPS_APP_DIR"

registry_logout() {
  docker logout ghcr.io >/dev/null 2>&1 || true
}
trap registry_logout EXIT

if [[ ! -f .env || ! -f backup.env ]]; then
  echo "Missing $VPS_APP_DIR/.env or backup.env. Complete the one-time VPS setup first." >&2
  exit 1
fi

chmod 600 .env backup.env
compose=(docker compose --env-file .env --env-file backup.env -f deploy/compose.yml)
previous_tag=$(cat .deployed-image-tag 2>/dev/null || true)

rollback() {
  echo "Deployment failed; attempting application rollback."
  if [[ -n "$previous_tag" && "$previous_tag" != "$IMAGE_TAG" ]]; then
    export IMAGE_TAG="$previous_tag"
    "${compose[@]}" pull api web || true
    "${compose[@]}" up -d --wait api web || true
    "${compose[@]}" up -d --wait --force-recreate --no-deps gateway || true
  else
    echo "No earlier image tag is recorded; inspect the service logs before retrying."
  fi
}
trap rollback ERR

prune_old_release_images() {
  local service repository ref

  for service in api web; do
    repository="${IMAGE_REPOSITORY}-${service}"
    while IFS= read -r ref; do
      [[ -z "$ref" ]] && continue
      if [[ "$ref" == "$repository:$IMAGE_TAG" ||
            "$ref" == "$repository:$previous_tag" ||
            "$ref" == "$repository:latest" ]]; then
        continue
      fi
      docker image rm "$ref" || true
    done < <(docker image ls "$repository" --format '{{.Repository}}:{{.Tag}}')
  done

  docker image prune -f
}

export IMAGE_REPOSITORY IMAGE_TAG APP_PORT
"${compose[@]}" --profile tools pull postgres gateway backup api web
"${compose[@]}" up -d --wait postgres

bash deploy/backup.sh
"${compose[@]}" --profile tools run --rm --interactive=false migrator
"${compose[@]}" up -d --wait --remove-orphans api web
"${compose[@]}" up -d --wait --force-recreate --no-deps gateway

curl --fail --silent --show-error --retry 5 --retry-all-errors \
  --retry-delay 2 --retry-max-time 30 --connect-timeout 3 --max-time 5 \
  "http://127.0.0.1:$APP_PORT/healthz" >/dev/null
curl --fail --silent --show-error --retry 5 --retry-all-errors \
  --retry-delay 2 --retry-max-time 30 --connect-timeout 3 --max-time 5 \
  "http://127.0.0.1:$APP_PORT/api/health/ready" >/dev/null

printf '%s\n' "$IMAGE_TAG" > .deployed-image-tag
install -m 0644 deploy/systemd/detailflow-backup.service /etc/systemd/system/
install -m 0644 deploy/systemd/detailflow-backup.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now detailflow-backup.timer
prune_old_release_images
trap - ERR
