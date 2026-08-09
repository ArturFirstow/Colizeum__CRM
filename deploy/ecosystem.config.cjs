// ─────────────────────────────────────────────────────────────────────────────
// Colizeum Agency — описание процесса для pm2.
// Запуск из папки проекта:  pm2 start deploy/ecosystem.config.cjs
// ─────────────────────────────────────────────────────────────────────────────

const path = require("node:path");

module.exports = {
  apps: [
    {
      name: "colizeum",
      // Папка проекта = на уровень выше этого файла. Так конфиг работает при
      // любом расположении: /var/www/colizeum, /root/Colizeum__CRM и т.д.
      cwd: path.resolve(__dirname, ".."),
      script: "node_modules/next/dist/bin/next",
      args: "start -H 127.0.0.1 -p 3000",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        // Сервер без IPv6: иначе исходящие запросы (Telegram, ИИ) ждут таймаута.
        NODE_OPTIONS: "--dns-result-order=ipv4first",
      },
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      max_memory_restart: "1G",
      time: true,
    },
  ],
};
