#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Colizeum Agency — резервная копия базы и загруженных файлов.
# Хранит последние 14 копий в /var/backups/colizeum.
#
# Запуск вручную:   bash <папка сервиса>/deploy/backup.sh
# Раз в сутки в 3:00 (добавить в crontab -e):
#   0 3 * * * bash <папка сервиса>/deploy/backup.sh >> /var/log/colizeum-backup.log 2>&1
#
# КОПИИ ШИФРУЮТСЯ, если в .env задан BACKUP_PASSPHRASE. Файлы получают
# окончание .enc. Как открыть копию обратно:
#
#   openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
#     -in  /var/backups/colizeum/db_2026-10-07_03-00.db.enc \
#     -out /tmp/восстановленная.db \
#     -pass pass:'<ваш BACKUP_PASSPHRASE>'
#
# Файлы из storage — так же, потом распаковать: tar -xzf восстановленный.tar.gz
# ⚠️ Пароль хранится ОТДЕЛЬНО от сервера. Потерян — копию не открыть никак.
# ⚠️ Раз в квартал проверяйте, что копия действительно восстанавливается.
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

# ── Шифрование копий ────────────────────────────────────────────────────────
# В копии лежит вся база: сотрудники, контакты клиентов, заявки с сайта. Копии
# живут отдельным файлом, их переносят и хранят — поэтому они шифруются.
# Пароль берём из .env (BACKUP_PASSPHRASE). Не задан — копия делается открытой,
# но об этом говорится вслух: молча отдавать незашифрованные ПДн нельзя.
# `|| true` обязателен: без него grep, не нашедший строку, роняет весь скрипт
# из-за set -e и pipefail — и копия не делается вовсе.
BACKUP_PASSPHRASE="${BACKUP_PASSPHRASE:-$(grep -E '^BACKUP_PASSPHRASE=' "$APP_DIR/.env" 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'" || true)}"

# Шифрует файл и удаляет открытый оригинал. Без пароля — оставляет как есть.
encrypt_file() {
  local file="$1"
  [ -f "$file" ] || return 0
  if [ -z "$BACKUP_PASSPHRASE" ]; then
    return 0
  fi
  if ! command -v openssl >/dev/null 2>&1; then
    echo "ВНИМАНИЕ: openssl не установлен — копия осталась НЕзашифрованной. Поставьте: apt install -y openssl"
    return 0
  fi
  if openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt \
      -in "$file" -out "$file.enc" -pass env:BACKUP_PASSPHRASE 2>/dev/null; then
    rm -f "$file"
  else
    rm -f "$file.enc"
    echo "ВНИМАНИЕ: не удалось зашифровать $file — копия осталась открытой."
  fi
}
export BACKUP_PASSPHRASE

if [ -z "$DB_FILE" ]; then
  echo "ВНИМАНИЕ: не удалось определить путь к базе (DATABASE_URL в $APP_DIR/.env)."
  echo "Копия базы НЕ сделана. Укажите путь вручную: DB_FILE=/путь/к/базе bash deploy/backup.sh"
elif [ ! -f "$DB_FILE" ]; then
  echo "ВНИМАНИЕ: файла базы нет по пути $DB_FILE — копия НЕ сделана."
  echo "(Для PostgreSQL это нормально: базу выгружайте через pg_dump.)"
fi

if [ -n "$DB_FILE" ] && [ -f "$DB_FILE" ]; then
  # .backup — корректная копия SQLite даже при работающем сервисе.
  # База работает в режиме WAL: свежие записи лежат в файле -wal и попадают
  # в основной файл не сразу. Поэтому запасной путь копирует и его — иначе
  # в копию не войдёт последний час работы.
  sqlite3 "$DB_FILE" ".backup '$BACKUP_DIR/db_$STAMP.db'" 2>/dev/null || {
    cp "$DB_FILE" "$BACKUP_DIR/db_$STAMP.db"
    [ -f "$DB_FILE-wal" ] && cp "$DB_FILE-wal" "$BACKUP_DIR/db_$STAMP.db-wal"
    [ -f "$DB_FILE-shm" ] && cp "$DB_FILE-shm" "$BACKUP_DIR/db_$STAMP.db-shm"
    echo "ВНИМАНИЕ: sqlite3 не установлен, копия сделана файлами. Поставьте: apt install -y sqlite3"
  }
  # Побочные файлы WAL шифруем тоже — в них свежие записи базы.
  encrypt_file "$BACKUP_DIR/db_$STAMP.db-wal"
  encrypt_file "$BACKUP_DIR/db_$STAMP.db-shm"
  encrypt_file "$BACKUP_DIR/db_$STAMP.db"
  echo "База сохранена: $BACKUP_DIR/db_$STAMP.db"
fi

if [ -d "$STORAGE_DIR" ]; then
  tar -czf "$BACKUP_DIR/storage_$STAMP.tar.gz" -C "$APP_DIR" storage
  encrypt_file "$BACKUP_DIR/storage_$STAMP.tar.gz"
  echo "Файлы сохранены: $BACKUP_DIR/storage_$STAMP.tar.gz"
fi

if [ -z "$BACKUP_PASSPHRASE" ]; then
  echo
  echo "⚠️  Копии НЕ зашифрованы: в .env не задан BACKUP_PASSPHRASE."
  echo "    В копии лежат данные сотрудников и клиентов. Задайте пароль:"
  echo "      openssl rand -base64 32      # придумать пароль"
  echo "      echo 'BACKUP_PASSPHRASE=\"<пароль>\"' >> $APP_DIR/.env"
  echo "    Пароль храните ОТДЕЛЬНО от сервера — без него копию не открыть."
fi

# Оставляем последние 14 копий каждого вида (и открытые, и зашифрованные).
ls -1t "$BACKUP_DIR"/db_*.db "$BACKUP_DIR"/db_*.db.enc 2>/dev/null | tail -n +15 | xargs -r rm -f
ls -1t "$BACKUP_DIR"/storage_*.tar.gz "$BACKUP_DIR"/storage_*.tar.gz.enc 2>/dev/null | tail -n +15 | xargs -r rm -f
ls -1t "$BACKUP_DIR"/db_*.db-wal "$BACKUP_DIR"/db_*.db-wal.enc 2>/dev/null | tail -n +15 | xargs -r rm -f
ls -1t "$BACKUP_DIR"/db_*.db-shm "$BACKUP_DIR"/db_*.db-shm.enc 2>/dev/null | tail -n +15 | xargs -r rm -f
