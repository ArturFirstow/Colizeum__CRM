#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Резервная копия боевых данных: база (prisma/dev.db) и загруженные файлы
# (storage). Это ЕДИНСТВЕННОЕ, что нельзя восстановить из GitHub — код там
# лежит, а данные живут только на сервере.
#
# Запуск вручную:   ./scripts/backup.sh
# Автоматически:    добавьте в cron (см. docs/ДЕПЛОЙ.md, раздел «Бэкапы»)
#
# Копии складываются в ../colizeum-backups и хранятся 14 дней.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")/.."
DEST="../colizeum-backups"
STAMP="$(date +%Y-%m-%d_%H-%M)"
mkdir -p "$DEST"

# Базу копируем средствами SQLite: простой cp может поймать её в момент
# записи и сохранить битый файл. Если sqlite3 не установлен — копируем как
# есть, но предупреждаем: такая копия менее надёжна.
if [ -f prisma/dev.db ]; then
  if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 prisma/dev.db ".backup '$DEST/dev_$STAMP.db'"
  else
    echo "  ⚠️  sqlite3 не установлен — копирую базу обычным способом."
    echo "     Надёжнее поставить: apt install -y sqlite3"
    cp prisma/dev.db "$DEST/dev_$STAMP.db"
  fi
  echo "  база      → $DEST/dev_$STAMP.db"
fi

if [ -d storage ]; then
  tar -czf "$DEST/storage_$STAMP.tar.gz" storage
  echo "  файлы     → $DEST/storage_$STAMP.tar.gz"
fi

# Чистим копии старше 14 дней, чтобы диск не забился.
find "$DEST" -type f -mtime +14 -delete 2>/dev/null || true

echo "  всего копий: $(find "$DEST" -type f | wc -l)"
