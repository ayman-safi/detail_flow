# Deployment files

The complete setup, backup, restore, rollback, and operations guide is in [`../DEPLOYMENT.md`](../DEPLOYMENT.md).

This directory is copied to `/opt/detailflow/deploy` by GitHub Actions. Keep secrets in the VPS-only `/opt/detailflow/.env` and `/opt/detailflow/backup.env` files; never add them here.
