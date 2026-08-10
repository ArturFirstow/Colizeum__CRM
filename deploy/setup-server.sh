#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Colizeum Agency — первичная настройка сервера (Ubuntu 22.04 / 24.04).
#
# Что делает: ставит Node.js 22, pm2, nginx, certbot; создаёт папку проекта,
# настраивает автозапуск и файрвол. Код и .env кладём отдельно (см. docs/DEPLOY.md).
#
# Запуск на сервере под root:
#   bash setup-server.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/colizeum}"

echo "==> 1/6 Обновляем систему"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y

echo "==> 2/6 Ставим базовые пакеты"
apt-get install -y curl git nginx ufw ca-certificates

echo "==> 3/6 Ставим Node.js 22 LTS"
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
node -v
npm -v

echo "==> 4/6 Ставим pm2 (менеджер процессов) и включаем автозапуск"
npm install -g pm2
pm2 startup systemd -u root --hp /root >/dev/null

echo "==> 5/6 Ставим certbot (бесплатный HTTPS-сертификат)"
apt-get install -y certbot python3-certbot-nginx

echo "==> 6/6 Файрвол: пускаем SSH, HTTP, HTTPS"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

mkdir -p "$APP_DIR"

echo
echo "Готово. Папка проекта: $APP_DIR"
echo "Дальше — шаг «Заливаем код» в docs/DEPLOY.md"
