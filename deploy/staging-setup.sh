#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Colizeum Agency — поднять ТЕСТОВЫЙ контур (требования 6.2 и 9.5).
#
# Что делает: готовит .env.staging, создаёт отдельную базу, заполняет её
# ВЫМЫШЛЕННЫМИ данными и запускает второй процесс pm2 на порту 3001.
# Боевой контур не трогает ничем.
#
# Запуск:  bash deploy/staging-setup.sh
#
# ⚠️ Данные в тестовый контур НЕ КОПИРУЮТСЯ с боевого. Требование 6.2 прямо
# говорит: «в тестовой — вымышленные данные». Копия боевой базы на тестовом
# сервере — это те же персональные данные, но с другим уровнем защиты и другим
# кругом доступа; именно так утечки и происходят.
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
ENV_FILE="$APP_DIR/.env.staging"
DB_FILE="$APP_DIR/prisma/staging.db"
STORAGE_DIR="$APP_DIR/storage-staging"

say()  { printf '\n\033[1m%s\033[0m\n' "$1"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; }
die()  { printf '  \033[31m✗\033[0m %s\n' "$1"; exit 1; }

cd "$APP_DIR" || die "не нашёл папку проекта"

say "1. Настройки тестового контура"
if [ -f "$ENV_FILE" ]; then
  ok ".env.staging уже есть — оставляю как есть"
else
  [ -f "$APP_DIR/.env" ] || die "нет боевого .env — сначала настройте основной сервис"

  # Берём боевой .env за основу и подменяем ТОЛЬКО то, что обязано отличаться.
  grep -vE '^(DATABASE_URL|STORAGE_LOCAL_DIR|AUTH_SECRET|APP_URL|APP_ENV|AI_API_KEY|TELEGRAM_BOT_TOKEN|MEETINGS_SHEET_WEBHOOK_URL|SEED_PW_)' \
    "$APP_DIR/.env" > "$ENV_FILE" 2>/dev/null || true

  SECRET=$(openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64)
  {
    echo ""
    echo "# ─── Тестовый контур. Заполнено deploy/staging-setup.sh ───"
    echo "APP_ENV=\"staging\""
    echo "DATABASE_URL=\"file:./staging.db\""
    echo "STORAGE_LOCAL_DIR=\"./storage-staging\""
    echo "# Свой секрет: с общим кука с теста подошла бы и к боевому сервису."
    echo "AUTH_SECRET=\"$SECRET\""
    echo "# Адрес тестового контура — поправьте на свой поддомен."
    echo "APP_URL=\"https://test.colizeum-agensy.space\""
    echo ""
    echo "# Внешние сервисы на тесте ВЫКЛЮЧЕНЫ намеренно: отладка не должна"
    echo "# слать людям уведомления, писать в рабочие таблицы и тратить деньги"
    echo "# на запросы к ИИ. Нужно проверить именно их — впишите ключи сюда."
    echo "# AI_API_KEY=\"\""
    echo "# TELEGRAM_BOT_TOKEN=\"\""
    echo "# MEETINGS_SHEET_WEBHOOK_URL=\"\""
    echo ""
    echo "# Пароли демо-сотрудников тестового контура."
    for k in SEED_PW_FIRSTOV SEED_PW_TURINOVA SEED_PW_YANYUK SEED_PW_CHEPELYUK SEED_PW_IVANUSHKIN; do
      echo "$k=\"$(openssl rand -base64 12 2>/dev/null | tr -d '/+=' | head -c 14)Test1\""
    done
  } >> "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  ok "создан .env.staging (своя база, свои файлы, свой секрет)"
fi

say "2. Отдельная база и папка файлов"
# Проверка от самой опасной ошибки: тестовый контур, смотрящий в боевую базу.
PROD_DB=$(grep -E '^DATABASE_URL=' "$APP_DIR/.env" 2>/dev/null | cut -d= -f2- | tr -d '"'"'"'')
TEST_DB=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | tail -1 | cut -d= -f2- | tr -d '"'"'"'')
[ -n "$TEST_DB" ] || die "в .env.staging не задан DATABASE_URL"
if [ "$PROD_DB" = "$TEST_DB" ]; then
  die "тестовая база совпадает с боевой ($TEST_DB) — так нельзя, поправьте .env.staging"
fi
ok "база тестового контура: $TEST_DB (боевая: ${PROD_DB:-не задана})"

mkdir -p "$STORAGE_DIR" && ok "папка файлов: $STORAGE_DIR"

say "3. Схема и вымышленные данные"
set -a; . "$ENV_FILE"; set +a
npx prisma db push --skip-generate >/dev/null 2>&1 \
  && ok "схема применена" || die "не удалось применить схему"

if [ -s "$DB_FILE" ] && [ "$(sqlite3 "$DB_FILE" 'select count(*) from User' 2>/dev/null || echo 0)" -gt 0 ]; then
  warn "в тестовой базе уже есть данные — сид пропущен"
  warn "заполнить заново: rm $DB_FILE && bash deploy/staging-setup.sh"
else
  npx prisma db seed >/dev/null 2>&1 \
    && ok "залиты демо-данные (вымышленные клиенты и сделки)" \
    || warn "сид не отработал — запустите вручную: npx prisma db seed"
fi

say "4. Запуск"
if command -v pm2 >/dev/null 2>&1; then
  pm2 delete colizeum-staging >/dev/null 2>&1
  pm2 start deploy/ecosystem.staging.config.cjs >/dev/null 2>&1 \
    && ok "процесс colizeum-staging запущен на порту 3001" \
    || warn "pm2 не смог запустить — посмотрите: pm2 logs colizeum-staging"
  pm2 save >/dev/null 2>&1
else
  warn "pm2 не установлен — на этой машине контур не запускается, настройки готовы"
fi

say "Что дальше"
cat <<'TXT'
  1. Собрать код, если ещё не собран:  npm run build
  2. Открыть снаружи: добавьте в nginx поддомен (например test.ваш-домен),
     проксируйте его на 127.0.0.1:3001 — по образцу deploy/nginx.conf.template,
     затем certbot для сертификата.
  3. Пароли демо-сотрудников лежат в .env.staging (строки SEED_PW_*).

  На каждой странице тестового контура идёт жёлтая полоса «ТЕСТОВЫЙ КОНТУР» —
  перепутать его с боевым нельзя.

  ⚠️ Боевые данные сюда не копируются. Нужен похожий на реальность набор —
  заводите его руками: это вымышленные записи, и они такими останутся.
TXT
