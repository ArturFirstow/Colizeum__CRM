#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Colizeum Agency — проверка боевого сервера одной командой.
# Ничего не меняет, только смотрит и печатает понятный отчёт.
#
# Запуск:  bash deploy/healthcheck.sh
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

# Папку сервиса берём от самого скрипта — он лежит внутри неё, в deploy/.
APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
PORT="${PORT:-3000}"

problems=0
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; problems=$((problems+1)); }
bad()  { printf '  \033[31m✗\033[0m %s\n' "$1"; problems=$((problems+1)); }
head_() { printf '\n\033[1m%s\033[0m\n' "$1"; }

head_ "Приложение"
if command -v pm2 >/dev/null 2>&1; then
  count=$(pm2 jlist 2>/dev/null | node -e "
    let s = '';
    process.stdin.on('data', (d) => (s += d)).on('end', () => {
      try { console.log(JSON.parse(s).filter((p) => p.name === 'colizeum').length); }
      catch { console.log(-1); }
    });
  " 2>/dev/null)
  [ -z "$count" ] && count=-1
  if [ "$count" -eq 1 ]; then
    ok "pm2: процесс colizeum запущен"
  elif [ "$count" -gt 1 ]; then
    bad "pm2: процессов colizeum $count — они дерутся за порт, лишние надо убрать"
    echo "      Исправить: pm2 delete all && pm2 start deploy/ecosystem.config.cjs && pm2 save"
  else
    bad "pm2: процесс colizeum не найден или упал → pm2 status; pm2 logs colizeum"
  fi
  if systemctl list-unit-files 2>/dev/null | grep -q '^pm2-'; then
    ok "автозапуск после перезагрузки настроен"
  else
    warn "автозапуск не настроен → pm2 startup, выполнить показанную команду, затем pm2 save"
  fi
else
  bad "pm2 не установлен"
fi

code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://127.0.0.1:${PORT}/login" 2>/dev/null)
[ "$code" = "200" ] && ok "приложение отвечает на порту ${PORT}" \
  || bad "приложение не отвечает на 127.0.0.1:${PORT} (код «${code:-нет ответа}»)"

head_ "Настройки (.env)"
if [ -f "$APP_DIR/.env" ]; then
  ok "файл .env на месте"
  secret=$(grep -E '^AUTH_SECRET=' "$APP_DIR/.env" | cut -d= -f2- | tr -d '"' | tr -d "'")
  if [ -z "$secret" ]; then
    bad "AUTH_SECRET не задан"
  elif [ "$secret" = "change-me-please-generate-a-long-random-secret-string" ] \
    || [ "$secret" = "ВСТАВЬТЕ_СЮДА_СЛУЧАЙНУЮ_СТРОКУ" ]; then
    bad "AUTH_SECRET оставлен из примера — его знает любой, кто видел репозиторий!"
    echo "      Исправить: openssl rand -base64 32 → вписать в .env → pm2 restart colizeum"
  elif [ ${#secret} -lt 32 ]; then
    warn "AUTH_SECRET короче 32 символов — лучше перегенерировать"
  else
    ok "AUTH_SECRET свой и достаточно длинный"
  fi
  grep -qE '^MEETINGS_SHEET_WEBHOOK_URL=".+"' "$APP_DIR/.env" \
    && ok "выгрузка встреч в Google-таблицу настроена" \
    || warn "выгрузка встреч в таблицу не настроена (docs/MEETINGS_SHEET.md)"
  grep -qE '^AI_API_KEY=".+"' "$APP_DIR/.env" \
    && ok "ключ ИИ задан" || warn "ключ ИИ не задан — ИИ-функции работать не будут"
else
  bad "нет файла $APP_DIR/.env"
fi

head_ "База данных и файлы"
db=$(grep -E '^DATABASE_URL=' "$APP_DIR/.env" 2>/dev/null | cut -d= -f2- | tr -d '"' | sed 's|^file:||')
# Относительный путь SQLite Prisma отсчитывает от папки со схемой (prisma/).
case "$db" in
  "" ) ;;
  /* ) ;;
  *  ) db="$APP_DIR/prisma/${db#./}" ;;
esac
if [ -n "$db" ] && [ -f "$db" ]; then
  ok "база на месте: $db ($(du -h "$db" | cut -f1))"
elif [ -n "$db" ]; then
  warn "файл базы не найден по пути $db (для PostgreSQL это нормально)"
fi
[ -d "$APP_DIR/storage" ] && ok "хранилище файлов: $(du -sh "$APP_DIR/storage" 2>/dev/null | cut -f1)" \
  || warn "папки storage нет — загруженные файлы негде хранить"

head_ "Резервные копии"
last=$(ls -1t /var/backups/colizeum/db_*.db 2>/dev/null | head -1)
if [ -n "$last" ]; then
  age=$(( ( $(date +%s) - $(stat -c %Y "$last") ) / 86400 ))
  [ "$age" -le 2 ] && ok "свежая копия базы: $(basename "$last")" \
    || warn "последняя копия базы сделана $age дн. назад"
else
  warn "копий базы нет → настройте ночной запуск deploy/backup.sh (см. docs/DEPLOY.md)"
fi
crontab -l 2>/dev/null | grep -q "backup.sh" && ok "бэкап в расписании cron" \
  || warn "бэкап не стоит в расписании: crontab -e"

head_ "Веб и сертификат"
systemctl is-active --quiet nginx && ok "nginx работает" || bad "nginx не работает"
nginx -t >/dev/null 2>&1 && ok "конфиг nginx без ошибок" || bad "ошибка в конфиге nginx → nginx -t"
if command -v certbot >/dev/null 2>&1; then
  exp=$(certbot certificates 2>/dev/null | grep -m1 "Expiry Date" | sed 's/.*: //')
  [ -n "$exp" ] && ok "сертификат: $exp" || warn "сертификатов не найдено"
  systemctl is-active --quiet certbot.timer && ok "автопродление сертификата включено" \
    || warn "certbot.timer выключен → systemctl enable --now certbot.timer"
else
  warn "certbot не установлен"
fi

head_ "Файрвол и место на диске"
if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
  ok "ufw включён"
  ufw status | grep -qE "^3000" && warn "порт 3000 открыт наружу — его должен закрывать nginx" \
    || ok "порт 3000 снаружи закрыт"
else
  warn "ufw выключен → ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw --force enable"
fi
use=$(df -P "$APP_DIR" | awk 'NR==2 {print $5}' | tr -d '%')
[ "${use:-0}" -lt 85 ] && ok "место на диске: занято ${use}%" || warn "диск занят на ${use}% — пора чистить"

head_ "Итог"
[ "$problems" -eq 0 ] && echo "  Всё в порядке." \
  || echo "  Пунктов, требующих внимания: $problems (отмечены ! и ✗)"
