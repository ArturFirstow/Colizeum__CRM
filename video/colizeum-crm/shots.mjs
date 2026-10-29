// Кадры сервиса для ролика.
//
// ⚠️ Отдельно от scripts/screens.mjs (тот снимает для документов, 1440×900 и
// всю страницу целиком). Ролику нужен ровно экран 1920×1080 — иначе кадр на
// монтаже придётся обрезать, и у интерфейса отрежет либо меню, либо низ.
//
// Запуск: нужен работающий `npm run dev` и пароли в переменных.
//   PW_OWNER=… node video/colizeum-crm/shots.mjs
import fs from "node:fs";
import path from "node:path";
import { chromium } from "/home/user/Colizeum__CRM/node_modules/playwright/index.mjs";

const BASE = "http://localhost:3000";
const OUT = path.join(import.meta.dirname, "public", "shots");
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
  args: ["--no-sandbox"],
});
const ctx = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("  [ошибка страницы]", e.message.slice(0, 100)));

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.fill("input[type=email]", process.env.EMAIL ?? "a.firstov@colizeum.ru");
await page.fill("input[type=password]", process.env.PW_OWNER ?? "");
await page.click("button[type=submit]");
await page.waitForURL(/dashboard/, { timeout: 90_000 });

// Плашка про cookie лежала бы на каждом кадре.
const ok = page.getByRole("button", { name: "Понятно" });
if (await ok.count()) await ok.first().click().catch(() => {});

async function shot(url, name, { scroll = 0, wait = 1800 } = {}) {
  await page.goto(BASE + url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(wait);
  if (scroll) {
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), scroll);
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: path.join(OUT, name + ".png") });
  console.log("✓", name);
}

await shot("/dashboard", "dashboard");
await shot("/deals", "deals");
await shot("/tasks", "tasks-board");
await shot("/tasks?view=clients", "tasks-week");
await shot("/finances", "finances");
await shot("/documents", "documents");
await shot("/ord", "ord");
await shot("/assistant", "assistant");
await shot("/leadership/audit", "audit");
await shot("/advertisers", "advertisers");

// Карточки — самые плотные экраны, их берём по первой попавшейся записи.
const firstAdv = await page.evaluate(async () => {
  const r = await fetch("/api/search?q=", { credentials: "include" });
  return null;
});
await page.goto(BASE + "/advertisers", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
const advHref = await page.locator('a[href^="/advertisers/"]').first().getAttribute("href");
if (advHref) await shot(advHref, "client-card", { scroll: 0 });
if (advHref) await shot(advHref, "client-timeline", { scroll: 1400 });

await page.goto(BASE + "/deals", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
const dealHref = await page.locator('a[href^="/deals/"]').first().getAttribute("href");
if (dealHref) await shot(dealHref, "deal-card");

await browser.close();
console.log("готово:", OUT);
