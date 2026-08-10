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

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

# Путь к базе берём из .env, чтобы копия делалась там, где база реально лежит.
# Относительный путь SQLite Prisma отсчитывает от папки со схемой (prisma/).
db_from_env() {
  local raw
  raw=$(grep -E '^DATABASE_URL=' "$APP_DIR/.env" 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'")
  raw="${raw#file:}"
  case "$raw" in
    "")  return 1 ;;
    /*)  echo "$raw" ;;
    *)   echo "$APP_DIR/prisma/${raw#./}" ;;
  esac
}

DB_FILE="${DB_FILE:-$(db_from_env)}"
STORAGE_DIR="${STORAGE_DIR:-$APP_DIR/storage}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/colizeum}"
STAMP="$(date +%Y-%m-%d_%H-%M)"

mkdir -p "$BACKUP_DIR"

if [ -z "$DB_FILE" ]; then
  echo "ВНИМАНИЕ: не удалось определить путь к базе (DATABASE_URL в $APP_DIR/.env)."
  echo "Копия базы НЕ сделана. Укажите путь вручную: DB_FILE=/путь/к/базе bash deploy/backup.sh"
elif [ ! -f "$DB_FILE" ]; then
  echo "ВНИМАНИЕ: файла базы нет по пути $DB_FILE — копия НЕ сделана."
  echo "(Для PostgreSQL это нормально: базу выгружайте через pg_dump.)"
fi

if [ -n "$DB_FILE" ] && [ -f "$DB_FILE" ]; then
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
