# FL-10 backup and restore runbook

Production backup runs on the Linux host with `restic`, Docker Compose, PostgreSQL and the
private file volumes.

Required production env values:

- `BACKUP_DIRECTORY`, for example `/srv/classops-backups`
- `BACKUP_RETENTION_DAYS=7`
- `RESTIC_PASSWORD`, stored as a host secret and not committed
- database values already present in `class-backend/.env.prod`

Backup:

```bash
RESTIC_PASSWORD='change-me' ./tools/backup-production.sh
```

The script creates `/maintenance/maintenance.flag` inside the backend container, waits briefly
for in-flight writes to drain, stores `pg_dump` and `/data/private-files` plus
`/data/staging-files` into the incremental restic repository, prunes to seven daily snapshots,
then removes maintenance mode through a trap.

Restore smoke test:

1. Restore the latest SQL dump and file tar from restic into a clean staging host.
2. Start PostgreSQL, restore with `psql -U "$POSTGRES_USER" "$POSTGRES_DB"`.
3. Extract file tar into the backend data volume.
4. Start backend and run health check.
5. Download several known files and compare SHA-256 with `stored_files.checksum_sha256`.
