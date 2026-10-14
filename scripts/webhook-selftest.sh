#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Проверка приёмника заявок с сайта — как будто это сделала Тильда.
#
#   bash scripts/webhook-selftest.sh                      # против localhost:3000
#   BASE=https://домен.ru bash scripts/webhook-selftest.sh # против боевого
#
# Ключ берётся из .env, на экран не печатается. Заявки создаются ПОДДЕЛЬНЫЕ,
# с вымышленным человеком — проверять на настоящих обращениях нельзя.
# После проверки тестовую заявку удалите в разделе «Входящие с сайта».
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

BASE="${BASE:-http://localhost:3000}"
KEY=$(grep -E '^LEADS_WEBHOOK_SECRET\s*=' .env | head -1 | sed -E 's/^[^=]+=\s*"?([^"]*)"?\s*$/\1/')
if [ -z "${KEY}" ]; then
  echo "В .env нет LEADS_WEBHOOK_SECRET. Выпустите ключ: npx tsx scripts/webhook-key.ts --new"
  exit 1
fi
URL="${BASE}/api/webhooks/tilda?key=${KEY}"
STAMP=$(date +%s)

say() { printf '\n— %s\n' "$1"; }

say "1. Неверный ключ — должно быть 401"
curl -s -o /dev/null -w '   код: %{http_code}\n' -X POST "${BASE}/api/webhooks/tilda?key=wrong-key" \
  -d "name=Проверка"

say "2. Адрес открыт в браузере (GET) — должно быть 200 и ok:true"
curl -s -w '\n   код: %{http_code}\n' "${URL}"

say "3. Проверочный запрос Тильды (поле test) — 200, заявку НЕ создаёт"
curl -s -w '\n   код: %{http_code}\n' -X POST "${URL}" -d "test=test"

say "4. Заявка как от формы сайта (обычная форма) — должна создаться"
curl -s -w '\n   код: %{http_code}\n' -X POST "${URL}" \
  --data-urlencode "name=Иван Петров" \
  --data-urlencode "name_company=ООО «Пример»" \
  --data-urlencode "contact=+7 900 000-00-00" \
  --data-urlencode "Textarea=Проверка вебхука, заявку можно удалять" \
  --data-urlencode "tranid=selftest:${STAMP}" \
  --data-urlencode "formid=form999" \
  --data-urlencode "Я согласен (-а) с политикой конфиденциальности=yes"

say "5. Та же заявка второй раз — должна определиться как повтор"
curl -s -w '\n   код: %{http_code}\n' -X POST "${URL}" \
  --data-urlencode "name=Иван Петров" \
  --data-urlencode "name_company=ООО «Пример»" \
  --data-urlencode "contact=+7 900 000-00-00" \
  --data-urlencode "Textarea=Проверка вебхука, заявку можно удалять" \
  --data-urlencode "tranid=selftest:${STAMP}" \
  --data-urlencode "formid=form999"

say "6. Заявка в формате JSON (если в Тильде включена эта галочка)"
curl -s -w '\n   код: %{http_code}\n' -X POST "${URL}" \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"Пётр Иванов\",\"name_company\":\"ИП Пример\",\"contact\":\"test@example.com\",\"Textarea\":\"Проверка JSON\",\"tranid\":\"selftest-json:${STAMP}\"}"

printf '\nГотово. Загляните в раздел «Входящие с сайта» — там должны появиться\nдве проверочные заявки. Удалите их после проверки.\n'
