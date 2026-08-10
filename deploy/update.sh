#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Colizeum Agency — обновление сервиса на боевом сервере.
# Забирает новый код, пересобирает, обновляет схему БД и перезапускает.
# ДАННЫЕ НЕ ТРОГАЕТ (сид не запускается — он бы очистил базу).
#
# Запуск на сервере:  bash /var/www/colizeum/deploy/update.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/colizeum}"
cd "$APP_DIR"

echo "==> Резервная копия базы"
bash deploy/backup.sh || echo "   (пропущено)"

echo "==> Забираем новый код"
git pull

echo "==> Ставим зависимости"
npm ci

echo "==> Обновляем схему базы (данные сохраняются)"
npx prisma db push

echo "==> Собираем сборку"
npm run build

echo "==> Перезапускаем"
pm2 restart colizeum

echo
echo "Готово. Логи:  pm2 logs colizeum"
