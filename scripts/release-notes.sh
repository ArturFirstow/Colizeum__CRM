#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Что приедет на сервер при следующем обновлении — и ничего не меняется.
#
#     npm run release:notes              — сравнить сервер с рабочей веткой
#     npm run release:notes -- имя-ветки — сравнить с другой веткой
#
# Зачем: перед обновлением боевого сервиса полезно увидеть список правок
# словами, а не узнавать их по изменившемуся интерфейсу. Запускать можно и на
# сервере (тогда «здесь» — это боевая версия), и у себя.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")/.."
BRANCH="${1:-claude/deploy-site-timeweb-domain-2m5dhk}"

git fetch origin "$BRANCH" --quiet
HERE="$(git rev-parse HEAD)"
THERE="$(git rev-parse "origin/$BRANCH")"

printf '\n\033[1mСейчас установлено\033[0m\n'
echo "  $(git rev-parse --short "$HERE") — $(git log -1 --format='%s (%ad)' --date=format:'%d.%m.%Y' "$HERE")"

printf '\n\033[1mВ ветке %s\033[0m\n' "$BRANCH"
echo "  $(git rev-parse --short "$THERE") — $(git log -1 --format='%s (%ad)' --date=format:'%d.%m.%Y' "$THERE")"

if [ "$HERE" = "$THERE" ]; then
  printf '\n\033[32mОбновлять нечего — код тот же.\033[0m\n\n'
  exit 0
fi

COUNT="$(git rev-list --count "$HERE..$THERE")"
if [ "$COUNT" = "0" ]; then
  printf '\n\033[1mНового в этой ветке нет.\033[0m\n'
else
  printf '\n\033[1mПриедет правок: %s\033[0m\n\n' "$COUNT"
  git log --reverse --format='  %ad  %s' --date=format:'%d.%m' "$HERE..$THERE"
fi

BEHIND="$(git rev-list --count "$THERE..$HERE" || echo 0)"
if [ "$BEHIND" != "0" ]; then
  printf '\n\033[33m⚠️  На сервере есть %s правок, которых в этой ветке нет — обновление стало бы откатом назад.\033[0m\n' "$BEHIND"
  echo "   Скорее всего указана не та ветка."
fi

printf '\n\033[1mДальше\033[0m\n'
echo "  Проверить готовность сервера, ничего не меняя:  ./scripts/deploy.sh --dry"
echo "  Обновить:                                      ./scripts/deploy.sh"
echo "  Подробно, что эти правки означают:             docs/ЧТО_НОВОГО.md"
echo
