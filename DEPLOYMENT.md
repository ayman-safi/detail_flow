# DetailFlow deployment

DetailFlow follows the same direct-Docker pattern as ConvertPilot, while keeping its own isolated Compose project, networks, volumes, image names, and host port.

## Runtime layout

- Public test URL: `http://57.129.48.181:8080`
- Caddy is the only public DetailFlow container. It owns host port `8080`.
- `/api/*` is routed to the ASP.NET Core API; every other path is routed to Next.js.
- PostgreSQL is available only on the private `detailflow_backend` Docker network.
- ConvertPilot continues to own ports `80` and `443`; this deployment does not alter them.
- This HTTP endpoint is for test data only. Keep `AUTH_COOKIE_SECURE=false` until a real HTTPS domain is configured.

## GitHub Actions

Two workflows have separate responsibilities:

1. `CI` runs API tests, the production dependency audit, frontend lint/build, and Compose validation on pull requests and `main`.
2. `Build and deploy VPS` starts only after `CI` succeeds on `main` (or by manual dispatch). It publishes immutable API/web images, creates an R2 backup, runs the EF migration bundle, starts the release, verifies health, and rolls the application images back if deployment fails.

Configure the GitHub `production` environment with these secrets:

- `VPS_HOST`: `57.129.48.181`
- `VPS_SSH_KEY`: the private deployment key
- `VPS_KNOWN_HOSTS`: the pinned output of `ssh-keyscan -H 57.129.48.181`

Optional repository variables are `VPS_USER` (`ubuntu`), `VPS_SSH_PORT` (`22`), `VPS_APP_DIR` (`/opt/detailflow`), and `APP_PORT` (`8080`).

## One-time VPS setup

1. Create `/opt/detailflow` and copy `.env.example` to `/opt/detailflow/.env`.
2. Replace every placeholder with production values. Use unrelated random values for the PostgreSQL password, JWT secret, and platform administrator password.
3. Copy `backup.env.example` to `/opt/detailflow/backup.env` and add a Cloudflare R2 token limited to the DetailFlow backup bucket.
4. Set both files to mode `600` and keep them off GitHub.
5. Allow inbound TCP `8080` in UFW and the OVH network firewall. Do not change the existing `80`/`443` rules.
6. Initialize the R2 repository once with `sudo bash /opt/detailflow/deploy/init-backups.sh`.
7. Run the GitHub deployment workflow. The nightly backup timer is installed after the first successful deployment.

The R2 repository format is:

```text
s3:https://<ACCOUNT_ID>.r2.cloudflarestorage.com/<BUCKET>/detailflow
```

The Restic password encrypts backup contents and metadata. Losing it makes the backups unrecoverable, so store it outside the VPS in a password manager.

## Backups and restore drills

Run an on-demand backup:

```bash
sudo bash /opt/detailflow/deploy/backup.sh
```

Restore the latest backup into a separate test database:

```bash
sudo bash /opt/detailflow/deploy/restore.sh
```

The default target is `detailflow_restore_test`. A production overwrite is deliberately blocked. It requires the production database name, snapshot, and an explicit confirmation flag:

```bash
sudo bash /opt/detailflow/deploy/restore.sh detailflow latest --allow-production
```

That path creates one more R2 backup before overwriting production. Application rollback does not automatically reverse a database migration; schema changes should remain backward-compatible, and a database restore must be an intentional operator decision.

## Operations

Useful checks on the VPS:

```bash
cd /opt/detailflow
sudo docker compose --env-file .env --env-file backup.env -f deploy/compose.yml ps
curl --fail http://127.0.0.1:8080/healthz
curl --fail http://127.0.0.1:8080/api/health/ready
systemctl status detailflow-backup.timer
journalctl -u detailflow-backup.service
```

Netdata will show the gateway, web, API, PostgreSQL, and temporary backup/migration containers separately. Alert first on sustained CPU, memory pressure, disk usage, container restarts, and failed systemd backup units.
