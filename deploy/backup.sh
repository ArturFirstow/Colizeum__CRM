#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Colizeum Agency — резервная копия базы и загруженных файлов.
# Хранит последние 14 копий в /var/backups/colizeum.
#
# Запуск вручную:   bash /var/www/colizeum/deploy/backup.sh
# Раз в сутки в 3:00 (добавить в crontab -e):
#   0 3 * * * bash /var/www/colizeum/deploy/backup.sh >> /var/log/colizeum-backup.log 2>&1
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/colizeum}"
DB_FILE="${DB_FILE:-$APP_DIR/data/prod.db}"
STORAGE_DIR="${STORAGE_DIR:-$APP_DIR/storage}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/colizeum}"
STAMP="$(date +%Y-%m-%d_%H-%M)"

mkdir -p "$BACKUP_DIR"

if [ -f "$DB_FILE" ]; then
  # .backup — корректная копия SQLite даже при работающем сервисе.
  sqlite3 "$DB_FILE" ".backup '$BACKUP_DIR/db_$STAMP.db'" 2>/dev/null \
    || cp "$DB_FILE" "$BACKUP_DIR/db_$STAMP.db"
  echo "База сохранена: $BACKUP_DIR/db_$STAMP.db"
fi

if [ -d "$STORAGE_DIR" ]; then
  tar -czf "$BACKUP_DIR/storage_$STAMP.tar.gz" -C "$APP_DIR" storage
  echo "Файлы сохранены: $BACKUP_DIR/storage_$STAMP.tar.gz"
fi

# Оставляем последние 14 копий каждого вида.
ls -1t "$BACKUP_DIR"/db_*.db 2>/dev/null | tail -n +15 | xargs -r rm -f
ls -1t "$BACKUP_DIR"/storage_*.tar.gz 2>/dev/null | tail -n +15 | xargs -r rm -f
