# DetailFlow VPS Deployment

This deployment publishes two images to GitHub Container Registry:

- `ghcr.io/<owner>/<repo>-api:<tag>`
- `ghcr.io/<owner>/<repo>-web:<tag>`

The VPS runs `docker-compose.prod.yml`, Postgres, the tagged API/web images, and Caddy for HTTPS.

## One-time VPS setup

Create a deploy user, install Docker with the Compose plugin, and create the app folder:

```bash
sudo adduser deploy
sudo usermod -aG docker deploy
sudo usermod -aG sudo deploy
sudo mkdir -p /home/deploy/app
sudo chown -R deploy:deploy /home/deploy/app
```

Create `/home/deploy/app/.env` from the root `.env.example`, then change the production values:

```bash
DB_CONNECTION_STRING=Host=postgres;Port=5432;Database=detailflow;Username=detailflow;Password=<strong-password>
JWT_SECRET=<64-character-random-secret>
AUTH_COOKIE_SECURE=true
FRONTEND_URL=https://your-domain.com
PUBLIC_API_URL=https://your-domain.com/api
POSTGRES_USER=detailflow
POSTGRES_PASSWORD=<strong-password>
POSTGRES_DB=detailflow
SITE_HOST=your-domain.com
```

Fill the R2, WhatsApp, and platform admin values needed by your installation.

## GitHub configuration

Add these repository secrets:

| Secret | Value |
|---|---|
| `VPS_HOST` | VPS IP or domain |
| `VPS_USER` | `deploy` |
| `VPS_SSH_KEY` | Private key allowed to SSH as `deploy` |
| `VPS_SSH_PORT` | Usually `22` |

Optional repository variable:

| Variable | Default |
|---|---|
| `VPS_APP_DIR` | `/home/deploy/app` |

The workflow uses the repository `GITHUB_TOKEN` for GHCR push/pull, so no GHCR PAT is required for normal same-repository deployments.

## Deploy flow

On a push to `main`, GitHub Actions:

1. Runs .NET tests, web lint, and web build.
2. Builds and pushes API and web images tagged with `sha-<full-commit-sha>` and `latest`.
3. Copies `docker-compose.prod.yml` and `deploy/Caddyfile` to the VPS.
4. Pulls the tagged images, starts Postgres, runs the API migration bundle, and restarts API/web/Caddy.

Manual deployments are available from the workflow dispatch button.

## Manual rollback

SSH to the VPS and run:

```bash
cd /home/deploy/app
export IMAGE_REPOSITORY=ghcr.io/<owner>/<repo>
export IMAGE_TAG=sha-<previous-full-commit-sha>
docker compose -f docker-compose.prod.yml pull api web
docker compose -f docker-compose.prod.yml up -d --no-deps api web
```
