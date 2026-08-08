// ─────────────────────────────────────────────────────────────────────────────
// Colizeum Agency — описание процесса для pm2.
// Запуск из папки проекта:  pm2 start deploy/ecosystem.config.cjs
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  apps: [
    {
      name: "colizeum",
      cwd: "/var/www/colizeum",
      script: "node_modules/next/dist/bin/next",
      args: "start -H 127.0.0.1 -p 3000",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      max_memory_restart: "1G",
      time: true,
    },
  ],
};
