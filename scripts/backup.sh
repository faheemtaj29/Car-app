#!/usr/bin/env bash
# Backs up the database and the uploaded photos into ./backups, and deletes
# backups older than KEEP_DAYS (default 14).
#
#   ./scripts/backup.sh                      (run from the folder with docker-compose.yml)
#
# Run it every night from cron, e.g.:  0 3 * * *  cd /srv/auto-marketplace && ./scripts/backup.sh
# IMPORTANT: copy ./backups to another machine or a cloud bucket as well (see DEPLOY.md);
# a backup on the same disk does not survive that disk failing.
#
# Overrides (mainly for testing): MONGO_CONTAINER, UPLOADS_VOLUME, DB_NAME, BACKUP_DIR, KEEP_DAYS
set -euo pipefail

DB_NAME="${DB_NAME:-auto_marketplace}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
# A failed run must not leave half-written files behind that look like backups.
trap 'rm -f "$BACKUP_DIR"/*.partial' EXIT

if [[ -z "${MONGO_CONTAINER:-}" ]]; then
  MONGO_CONTAINER="$(docker compose ps -q mongo)"
  [[ -n "$MONGO_CONTAINER" ]] || { echo "Cannot find the mongo container. Is the stack running?" >&2; exit 1; }
fi
if [[ -z "${UPLOADS_VOLUME:-}" ]]; then
  UPLOADS_VOLUME="$(docker volume ls -q | grep -E '(^|_)uploads$' | head -1 || true)"
fi

DB_FILE="$BACKUP_DIR/db-$STAMP.archive.gz"
echo "Backing up database '$DB_NAME' → $DB_FILE"
docker exec "$MONGO_CONTAINER" mongodump --db "$DB_NAME" --archive --gzip > "$DB_FILE.partial"
mv "$DB_FILE.partial" "$DB_FILE"   # a half-written file never looks like a good backup

if [[ -n "${UPLOADS_VOLUME:-}" ]]; then
  PHOTO_FILE="$BACKUP_DIR/photos-$STAMP.tar.gz"
  echo "Backing up photos (volume '$UPLOADS_VOLUME') → $PHOTO_FILE"
  # Reuse the database image for tar: it is already on this server, so nothing is downloaded.
  TOOL_IMAGE="$(docker inspect --format '{{.Config.Image}}' "$MONGO_CONTAINER")"
  docker run --rm --entrypoint tar -v "$UPLOADS_VOLUME":/photos-src:ro "$TOOL_IMAGE" czf - -C /photos-src . > "$PHOTO_FILE.partial"
  mv "$PHOTO_FILE.partial" "$PHOTO_FILE"
else
  echo "No local uploads volume found (using cloud storage?). Back up your bucket separately."
fi

# Delete old backups.
find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'db-*.archive.gz' -o -name 'photos-*.tar.gz' \) -mtime +"$KEEP_DAYS" -print -delete | sed 's/^/Removed old backup: /'
echo "Done. Backups kept for $KEEP_DAYS days."
