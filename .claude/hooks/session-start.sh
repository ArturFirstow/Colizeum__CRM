#!/bin/bash
# SessionStart hook — готовит Colizeum Workspace к работе в сессии Claude Code
# (особенно в Claude Code on the web, где контейнер создаётся с нуля).
# Идемпотентен: безопасно запускать повторно.
set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}"

# .env нужен для DATABASE_URL и AUTH_SECRET (в git не коммитится).
if [ ! -f .env ]; then
  cp .env.example .env
  echo "[session-start] создан .env из .env.example"
fi

# Зависимости (npm install идемпотентен и кешируется в контейнере).
echo "[session-start] npm install…"
npm install --no-audit --no-fund

# Prisma client + схема БД (SQLite dev.db).
echo "[session-start] prisma generate + db push…"
npx prisma generate
npx prisma db push --skip-generate

# Сид только если БД пустая (не затираем данные при resume/clear/compact).
USERS=$(node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.user.count().then(n=>{console.log(n);return p.\$disconnect()}).catch(()=>{console.log(0)})" 2>/dev/null || echo 0)
if [ "${USERS:-0}" = "0" ]; then
  echo "[session-start] БД пустая → сидим демо-данные…"
  npx tsx prisma/seed.ts
else
  echo "[session-start] в БД уже есть данные (пользователей: $USERS) → сид пропущен"
fi

echo "[session-start] готово. Запуск: npm run dev"
