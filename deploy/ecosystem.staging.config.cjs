// ─────────────────────────────────────────────────────────────────────────────
// Colizeum Agency — ТЕСТОВЫЙ контур для pm2 (требования 6.2 и 9.5).
//
// Второй процесс того же кода, но со своей базой, своими файлами, своим портом
// и своим .env. Боевой контур он не трогает ничем.
//
// Запуск из папки проекта:  pm2 start deploy/ecosystem.staging.config.cjs
//
// ⚠️ ТРИ ВЕЩИ, КОТОРЫЕ ДОЛЖНЫ ОТЛИЧАТЬСЯ, И ПОЧЕМУ:
//
//   1. DATABASE_URL — своя база. Общая база означает, что отладка пишет в
//      боевые данные; «тестовый контур» на одной базе с боевым — это не
//      тестовый контур.
//   2. STORAGE_LOCAL_DIR — своя папка файлов. Иначе тестовая загрузка ляжет
//      рядом с настоящими договорами.
//   3. AUTH_SECRET — свой. Если секрет общий, кука, выданная на тесте,
//      подойдёт и к боевому сервису: это дыра, а не удобство.
//
// Всё это задаётся в .env.staging рядом с обычным .env, а здесь только путь
// к нему и порт.
// ─────────────────────────────────────────────────────────────────────────────

const path = require("node:path");

module.exports = {
  apps: [
    {
      name: "colizeum-staging",
      cwd: path.resolve(__dirname, ".."),
      script: "node_modules/next/dist/bin/next",
      args: "start -H 127.0.0.1 -p 3001",
      env: {
        NODE_ENV: "production",
        // Включает жёлтую полосу «ТЕСТОВЫЙ КОНТУР» на каждой странице.
        APP_ENV: "staging",
        PORT: "3001",
        // Next читает .env.production при NODE_ENV=production. Чтобы тестовый
        // контур взял свои настройки, передаём файл явным путём.
        DOTENV_CONFIG_PATH: path.resolve(__dirname, "..", ".env.staging"),
        NODE_OPTIONS: "--dns-result-order=ipv4first -r dotenv/config",
      },
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      max_memory_restart: "1G",
      time: true,
    },
  ],
};
