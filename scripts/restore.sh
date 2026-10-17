#!/usr/bin/env bash
# Restores a database backup made by backup.sh.
#
#   ./scripts/restore.sh backups/db-20261017-030000.archive.gz            replaces the live database
#   ./scripts/restore.sh backups/db-....archive.gz --into auto_check      restores into a SEPARATE database
#                                                                          to look at it safely first
#   ./scripts/restore.sh backups/photos-20261017-030000.tar.gz            restores photos into the uploads volume
#
# Restoring over the live database overwrites it, so you are asked to confirm.
set -euo pipefail

FILE="${1:?Usage: restore.sh <backup file> [--into <database name>]}"
[[ -f "$FILE" ]] || { echo "No such file: $FILE" >&2; exit 1; }
DB_NAME="${DB_NAME:-auto_marketplace}"
INTO=""
[[ "${2:-}" == "--into" ]] && INTO="${3:?Give a database name after --into}"

if [[ -z "${MONGO_CONTAINER:-}" ]]; then
  MONGO_CONTAINER="$(docker compose ps -q mongo)"
  [[ -n "$MONGO_CONTAINER" ]] || { echo "Cannot find the mongo container. Is the stack running?" >&2; exit 1; }
fi

if [[ "$FILE" == *photos-*.tar.gz ]]; then
  UPLOADS_VOLUME="${UPLOADS_VOLUME:-$(docker volume ls -q | grep -E '(^|_)uploads$' | head -1)}"
  echo "Restoring photos into volume '$UPLOADS_VOLUME' (existing files with the same name are replaced)."
  TOOL_IMAGE="$(docker inspect --format '{{.Config.Image}}' "$MONGO_CONTAINER")"
  docker run --rm -i --entrypoint tar -v "$UPLOADS_VOLUME":/photos-dest "$TOOL_IMAGE" xzf - -C /photos-dest < "$FILE"
  echo "Photos restored."
  exit 0
fi

TARGET="${INTO:-$DB_NAME}"
if [[ -z "$INTO" ]]; then
  read -r -p "This REPLACES the live database '$DB_NAME' with $FILE. Type YES to continue: " ok
  [[ "$ok" == "YES" ]] || { echo "Cancelled."; exit 1; }
fi
echo "Restoring into database '$TARGET'…"
docker exec -i "$MONGO_CONTAINER" mongorestore --archive --gzip --drop --nsFrom "$DB_NAME.*" --nsTo "$TARGET.*" < "$FILE"
echo "Database restored into '$TARGET'."
