// ─────────────────────────────────────────────────────────────────────────────
// Ключ для приёма заявок с сайта и готовый адрес, который вставляется в Тильде.
//
//   npx tsx scripts/webhook-key.ts                 — показать текущий адрес
//   npx tsx scripts/webhook-key.ts --new           — выпустить новый ключ
//
// Что делает `--new`: придумывает случайный ключ, дописывает строку
// LEADS_WEBHOOK_SECRET в `.env` (старую заменяет) и печатает готовый адрес.
// После этого нужно перезапустить сервис (`pm2 restart colizeum`) и вставить
// новый адрес в Тильду — старый перестанет работать сразу.
//
// ⚠️ Адрес с ключом = доступ к приёму заявок. Его не публикуют, не кладут в
// код страницы сайта и не пересылают в общий чат. Если ключ куда-то утёк —
// выпустите новый этой же командой.
// ─────────────────────────────────────────────────────────────────────────────

import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ENV_PATH = path.join(process.cwd(), ".env");
const KEY = "LEADS_WEBHOOK_SECRET";

function readEnv(): string {
  return fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8") : "";
}

function valueOf(text: string, name: string): string {
  const m = text.match(new RegExp(`^${name}\\s*=\\s*"?([^"\\n\\r]*)"?\\s*$`, "m"));
  return m ? m[1].trim() : "";
}

function appUrl(text: string): string {
  const fromEnv = (process.env.APP_URL || valueOf(text, "APP_URL")).replace(/\/+$/, "");
  return fromEnv || "https://<адрес вашего сервиса>";
}

function writeSecret(text: string, secret: string): string {
  const line = `${KEY}="${secret}"`;
  if (new RegExp(`^${KEY}\\s*=`, "m").test(text)) {
    return text.replace(new RegExp(`^${KEY}\\s*=.*$`, "m"), line);
  }
  // ⚠️ Перенос строки В НАЧАЛЕ: если файл не оканчивается переводом строки,
  // новая настройка приклеится к предыдущей, и обе перестанут читаться.
  return `${text}${text.endsWith("\n") || text === "" ? "" : "\n"}${line}\n`;
}

function main() {
  const makeNew = process.argv.includes("--new");
  let text = readEnv();
  let secret = valueOf(text, KEY);

  if (makeNew || !secret) {
    if (!makeNew) {
      console.log("Ключ ещё не выпущен — выпускаю.\n");
    }
    secret = randomBytes(24).toString("base64url");
    text = writeSecret(text, secret);
    fs.writeFileSync(ENV_PATH, text);
    console.log(`Новый ключ записан в ${ENV_PATH}`);
    console.log("Перезапустите сервис, чтобы он его прочитал:  pm2 restart colizeum\n");
  }

  const url = `${appUrl(text)}/api/webhooks/tilda?key=${secret}`;
  console.log("Адрес для Тильды (Настройки сайта → Формы → Webhook → Webhook URL):\n");
  console.log("  " + url + "\n");
  console.log("Проверить, что приёмник отвечает (с сервера или со своего компьютера):\n");
  console.log(`  curl -i "${url}"\n`);
  console.log("Должен ответить 200 и {\"ok\":true,…}. Инструкция — docs/ВЕБХУК_ТИЛЬДА.md");
  console.log("⚠️ Этот адрес не публикуйте: он и есть доступ к приёму заявок.");
}

main();
