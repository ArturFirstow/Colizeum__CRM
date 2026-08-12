#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Почему сайт подтормаживает — проверка на боевом сервере.
#
# Запуск на сервере:   bash deploy/perf-check.sh colizeum-agensy.space
#
# Скрипт ничего не меняет, только смотрит и объясняет, что нашёл.
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOMAIN="${1:-}"

ok()   { echo "  ✅ $1"; }
bad()  { echo "  ❌ $1"; }
warn() { echo "  ⚠️  $1"; }

echo
echo "═══ 1. База данных ═══"
DB_FILE=""
if [ -f "$APP_DIR/.env" ]; then
  URL=$(grep -E '^DATABASE_URL=' "$APP_DIR/.env" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
  case "$URL" in
    file:*)
      P="${URL#file:}"
      case "$P" in
        /*) DB_FILE="$P" ;;
        *)  DB_FILE="$APP_DIR/prisma/$P" ;;
      esac
      ;;
  esac
fi

if [ -n "$DB_FILE" ] && [ -f "$DB_FILE" ]; then
  echo "  файл: $DB_FILE ($(du -h "$DB_FILE" | cut -f1))"
  if command -v sqlite3 >/dev/null 2>&1; then
    MODE=$(sqlite3 "$DB_FILE" "PRAGMA journal_mode;" 2>/dev/null)
    if [ "$MODE" = "wal" ]; then
      ok "режим WAL включён — запись не блокирует тех, кто читает страницы"
    else
      bad "режим «$MODE»: пока кто-то пишет (сообщение, задача), все остальные ждут"
      echo "     Лечится один раз:  sqlite3 \"$DB_FILE\" \"PRAGMA journal_mode=WAL;\""
      echo "     (сервис сам включает WAL при старте — если тут не 'wal',"
      echo "      значит на сервере ещё не раскатана свежая версия)"
    fi
  else
    warn "нет sqlite3, режим базы не проверить. Поставить: apt install -y sqlite3"
  fi
else
  warn "база не найдена — проверьте DATABASE_URL в .env"
fi

echo
echo "═══ 2. Скорость самого сервиса (10 запросов подряд) ═══"
# Скрипт часто запускают сразу после update.sh, когда сервис ещё
# поднимается. Ждём до 20 секунд, прежде чем объявлять его мёртвым.
UP=0
for _ in $(seq 1 10); do
  if curl -s -o /dev/null --max-time 3 "http://127.0.0.1:3000/login" 2>/dev/null; then UP=1; break; fi
  sleep 2
done

if [ "$UP" = "0" ]; then
  bad "сервис не отвечает на 127.0.0.1:3000 — смотрите pm2 logs colizeum"
else
  TOTAL=0
  OKN=0
  for _ in $(seq 1 10); do
    T=$(curl -s -o /dev/null --max-time 5 -w "%{time_total}" "http://127.0.0.1:3000/login" 2>/dev/null) || continue
    TOTAL=$(awk "BEGIN{print $TOTAL + $T}")
    OKN=$((OKN + 1))
  done
  if [ "$OKN" -eq 0 ]; then
    bad "запросы не проходят — смотрите pm2 logs colizeum"
  else
    AVG=$(awk "BEGIN{printf \"%.0f\", ($TOTAL / $OKN) * 1000}")
    echo "  среднее по $OKN запросам: ${AVG} мс"
    if [ "$AVG" -lt 150 ]; then
      ok "сам сервис отвечает быстро — если тормозит в браузере, дело в сети или nginx (пункт 3)"
    elif [ "$AVG" -lt 500 ]; then
      warn "заметная задержка — сервер загружен, смотрите пункт 4"
    else
      bad "сервис отвечает медленно — смотрите пункт 4, скорее всего не хватает памяти"
    fi
  fi
fi

echo
echo "═══ 3. Как отдаётся сайт наружу ═══"
if [ -z "$DOMAIN" ]; then
  warn "домен не указан — запустите: bash deploy/perf-check.sh ваш-домен.ru"
else
  # Обычным запросом, а не HEAD: на HEAD тела нет, и сервер не ставит
  # заголовок о сжатии — раньше скрипт из-за этого врал «идёт несжатым».
  HDR=$(curl -s -o /dev/null -D - -H 'Accept-Encoding: gzip, br' "https://$DOMAIN/login" 2>/dev/null)
  if [ -z "$HDR" ]; then
    bad "сайт не открывается по https://$DOMAIN"
  else
    if echo "$HDR" | head -1 | grep -q "HTTP/2"; then
      ok "HTTP/2 включён — страница грузится в один заход"
    else
      bad "HTTP/2 выключен: браузер тянет ~10 файлов страницы по очереди"
      echo "     Лечится: в /etc/nginx/sites-available/colizeum строку"
      echo "       listen 443 ssl;        заменить на"
      echo "       listen 443 ssl http2;"
      echo "     потом:  nginx -t && systemctl reload nginx"
      echo "     (отдельная директива 'http2 on;' работает только с nginx 1.25+,"
      echo "      в Ubuntu 24.04 идёт 1.24 — там сервер с ней не запустится)"
    fi
    if echo "$HDR" | grep -qi "^content-encoding"; then
      ok "сжатие работает ($(echo "$HDR" | grep -i '^content-encoding' | tr -d '\r' | awk '{print $2}'))"
    else
      warn "ответ идёт несжатым — проверьте блок gzip в конфиге nginx"
    fi
  fi
fi

echo
echo "═══ 4. Железо сервера ═══"
echo "  память:"
free -h 2>/dev/null | sed 's/^/    /'
if command -v pm2 >/dev/null 2>&1; then
  echo "  процесс:"
  pm2 jlist 2>/dev/null | node -e "
    let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
      try{
        for(const p of JSON.parse(s)){
          const m=Math.round((p.monit?.memory||0)/1048576);
          console.log('    '+p.name+': '+m+' МБ, перезапусков '+(p.pm2_env?.restart_time??0)+', статус '+(p.pm2_env?.status??'?'));
        }
      }catch(e){console.log('    не прочитать pm2')}
    });"
fi
SWAP=$(free -m 2>/dev/null | awk '/Swap/ {print $2}')
if [ -n "${SWAP:-}" ] && [ "$SWAP" -eq 0 ]; then
  warn "своп-файла нет: при нехватке памяти сборка и сервис падают, а не подтормаживают"
  echo "     Добавить 2 ГБ:  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile"
  echo "     и строку в /etc/fstab:  /swapfile none swap sw 0 0"
fi

echo
echo "Готово."
