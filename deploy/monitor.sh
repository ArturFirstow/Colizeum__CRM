#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Colizeum Agency — сторож. Проверяет, что сервис жив, и пишет в Telegram,
# когда что-то не так (требование 6.7: уведомления о недоступности).
#
# Почему отдельным скриптом, а не внутри сервиса: когда сервис упал, он уже
# ничего не отправит. Сообщать о падении должен кто-то снаружи.
#
# Что проверяет:
#   • отвечает ли приложение на своём порту;
#   • жив ли процесс в pm2;
#   • не кончается ли место на диске;
#   • не истекает ли сертификат;
#   • свежая ли резервная копия базы.
#
# Установка в расписание (раз в 5 минут):
#   crontab -e
#   */5 * * * * bash /var/www/colizeum/deploy/monitor.sh >/dev/null 2>&1
#
# Куда писать — в .env рядом с настройками бота:
#   TELEGRAM_BOT_TOKEN="…"            (уже есть, см. docs/TELEGRAM.md)
#   ALERT_TELEGRAM_CHAT_ID="123,456"  кому слать тревоги, через запятую
#
# Не задан ALERT_TELEGRAM_CHAT_ID — скрипт только печатает отчёт в консоль,
# это нормально для первой проверки руками:
#   bash deploy/monitor.sh
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
PORT="${PORT:-3000}"
STATE_DIR="${STATE_DIR:-/var/lib/colizeum-monitor}"
STATE_FILE="$STATE_DIR/state"
# Пока проблема не ушла — напоминаем раз в 6 часов, а не каждые 5 минут.
REMIND_AFTER=$((6 * 3600))

# ── Настройки из .env ────────────────────────────────────────────────────────
# `|| true`: без него grep, не нашедший строку, роняет скрипт под set -o pipefail
# и проверка не выполняется вовсе — ровно та ошибка, что была в backup.sh.
read_env() {
  [ -f "$APP_DIR/.env" ] || return 0
  grep -E "^$1=" "$APP_DIR/.env" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"' | tr -d "'" || true
}

TOKEN="${TELEGRAM_BOT_TOKEN:-$(read_env TELEGRAM_BOT_TOKEN)}"
CHATS="${ALERT_TELEGRAM_CHAT_ID:-$(read_env ALERT_TELEGRAM_CHAT_ID)}"
SITE="$(read_env APP_URL)"

notify() {
  local text="$1"
  echo "$text"
  [ -n "$TOKEN" ] && [ -n "$CHATS" ] || return 0
  local IFS=','
  for chat in $CHATS; do
    chat="$(echo "$chat" | tr -d '[:space:]')"
    [ -n "$chat" ] || continue
    curl -s -m 15 -o /dev/null \
      --data-urlencode "chat_id=$chat" \
      --data-urlencode "text=$text" \
      --data-urlencode "disable_web_page_preview=true" \
      "https://api.telegram.org/bot$TOKEN/sendMessage" || true
  done
}

# ── Проверки ────────────────────────────────────────────────────────────────
problems=()

# curl при полном отсутствии ответа печатает «000» — для человека это «не
# отвечает вовсе», а не какой-то код ответа.
human_code() { case "${1:-}" in ""|000) echo "нет ответа";; *) echo "код $1";; esac; }

code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "http://127.0.0.1:${PORT}/login" 2>/dev/null)
if [ "$code" != "200" ]; then
  problems+=("Сервис не отвечает на порту ${PORT} ($(human_code "$code")).")
fi

if command -v pm2 >/dev/null 2>&1; then
  if ! pm2 pid colizeum >/dev/null 2>&1 || [ -z "$(pm2 pid colizeum 2>/dev/null | tr -d '[:space:]')" ]; then
    problems+=("Процесс colizeum в pm2 не запущен.")
  fi
fi

# Снаружи — проверяем, что домен реально открывается (сертификат, nginx, DNS).
if [ -n "$SITE" ]; then
  ext=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "${SITE%/}/login" 2>/dev/null)
  case "$ext" in
    200|301|302|307|308) ;;
    *) problems+=("Снаружи сайт не открывается: ${SITE%/}/login → $(human_code "$ext").") ;;
  esac
fi

use=$(df -P "$APP_DIR" 2>/dev/null | awk 'NR==2 {print $5}' | tr -d '%')
if [ -n "${use:-}" ] && [ "$use" -ge 90 ]; then
  problems+=("Диск занят на ${use}% — скоро перестанут загружаться файлы и писаться база.")
fi

if command -v certbot >/dev/null 2>&1; then
  exp=$(certbot certificates 2>/dev/null | grep -m1 "Expiry Date" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' || true)
  if [ -n "$exp" ]; then
    left=$(( ( $(date -d "$exp" +%s 2>/dev/null || echo 0) - $(date +%s) ) / 86400 ))
    [ "$left" -le 10 ] && [ "$left" -gt -3650 ] \
      && problems+=("Сертификат истекает через ${left} дн. → systemctl status certbot.timer")
  fi
fi

last=$(ls -1t /var/backups/colizeum/db_* 2>/dev/null | head -1)
if [ -z "$last" ]; then
  problems+=("Резервных копий базы нет — восстановить сервис при поломке будет нечем.")
else
  age=$(( ( $(date +%s) - $(stat -c %Y "$last") ) / 86400 ))
  [ "$age" -gt 2 ] && problems+=("Последняя копия базы сделана ${age} дн. назад.")
fi

# ── Сравниваем с прошлым разом ───────────────────────────────────────────────
mkdir -p "$STATE_DIR" 2>/dev/null || true
prev_sig=""; prev_at=0
if [ -f "$STATE_FILE" ]; then
  prev_sig=$(sed -n 1p "$STATE_FILE")
  prev_at=$(sed -n 2p "$STATE_FILE")
  prev_at=${prev_at:-0}
fi

host=$(hostname 2>/dev/null || echo "сервер")
now=$(date +%s)

if [ ${#problems[@]} -eq 0 ]; then
  if [ -n "$prev_sig" ]; then
    notify "✅ Colizeum Agency: всё работает. Предыдущие замечания ушли. ($host)"
  else
    echo "Всё в порядке."
  fi
  printf '' > "$STATE_FILE" 2>/dev/null || true
  exit 0
fi

sig=$(printf '%s\n' "${problems[@]}" | md5sum | cut -d' ' -f1)
age_sig=$(( now - prev_at ))
if [ "$sig" = "$prev_sig" ] && [ "$age_sig" -lt "$REMIND_AFTER" ]; then
  echo "Те же замечания, о них уже сообщили $((age_sig / 60)) мин. назад — молчим."
  exit 1
fi

text="🔴 Colizeum Agency — проверка сервера ($host)"$'\n'
for p in "${problems[@]}"; do text+=$'\n'"• $p"; done
text+=$'\n\n'"Подробный разбор: bash $APP_DIR/deploy/healthcheck.sh"
notify "$text"

{ echo "$sig"; echo "$now"; } > "$STATE_FILE" 2>/dev/null || true
exit 1
