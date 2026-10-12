#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Вернуть прежнюю версию кода после неудачного обновления.
#
#     ./scripts/rollback.sh          — вернуться на версию, которая была до
#                                      последнего ./scripts/deploy.sh
#     ./scripts/rollback.sh <хэш>    — вернуться на конкретную версию
#
# ЧТО ЭТО ДЕЛАЕТ: возвращает КОД и пересобирает сервис. База и загруженные
# файлы не трогаются — они живут отдельно от кода.
#
# ⚠️ Чего откат НЕ отменяет: изменений схемы базы. Схема у нас меняется
# добавлением (новые столбцы и таблицы), поэтому прежний код с новой схемой
# работает — лишние столбцы он просто не замечает. Если же откат нужен из-за
# самой схемы, базу восстанавливают из копии, снятой перед обновлением:
# /var/backups/colizeum (как открыть — в шапке deploy/backup.sh).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")/.."
PORT="${PORT:-3000}"
TARGET="${1:-}"

if [ -z "$TARGET" ]; then
  if [ ! -f .deploy-prev ]; then
    echo "Не знаю, куда откатываться: файла .deploy-prev нет."
    echo "Он создаётся при обновлении через ./scripts/deploy.sh."
    echo
    echo "Посмотрите историю и укажите версию вручную:"
    echo "  git log --oneline -10"
    echo "  ./scripts/rollback.sh <хэш>"
    exit 1
  fi
  TARGET="$(cat .deploy-prev)"
fi

if ! git cat-file -e "${TARGET}^{commit}" 2>/dev/null; then
  echo "Версия $TARGET не найдена в истории. Проверьте: git log --oneline -10"
  exit 1
fi

echo "Сейчас:  $(git rev-parse --short HEAD) — $(git log -1 --format=%s)"
echo "Вернуть: $(git rev-parse --short "$TARGET") — $(git log -1 --format=%s "$TARGET")"
echo
printf 'Откатить код на эту версию? Напишите «да» и Enter: '
read -r ANSWER
[ "$ANSWER" = "да" ] || { echo "Отменено. Ничего не изменилось."; exit 1; }

# Текущую версию запоминаем ещё раз — чтобы можно было вернуться обратно,
# если откат окажется ошибкой.
git rev-parse HEAD > .deploy-prev

echo "▸ Возвращаю код…"
git reset --hard "$TARGET"

echo "▸ Ставлю зависимости той версии…"
npm ci

echo "▸ Собираю…"
npx prisma generate
npm run build

echo "▸ Перезапускаю…"
pm2 restart colizeum --update-env || pm2 start deploy/ecosystem.config.cjs

echo "▸ Проверяю, что сайт отвечает…"
for _ in $(seq 1 20); do
  CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:$PORT/login" || true)"
  if [ "$CODE" = "200" ] || [ "$CODE" = "307" ] || [ "$CODE" = "302" ]; then
    echo
    echo "✅ Откат выполнен. Версия: $(git rev-parse --short HEAD) — $(git log -1 --format=%s)"
    echo "   Вернуться обратно: ./scripts/rollback.sh"
    exit 0
  fi
  sleep 3
done

echo
echo "⚠️ Код откатили, но сайт не отвечает на порту $PORT."
echo "   Смотрите причину: pm2 logs colizeum --lines 50"
exit 1
