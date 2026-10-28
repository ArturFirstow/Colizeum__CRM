/**
 * Примерка масштаба интерфейса: один и тот же экран в нескольких размерах.
 *
 * Весь интерфейс собран в rem — и шрифты, и отступы. Поэтому размер меняется
 * одной строкой в `src/app/globals.css` (`html { font-size: … }`), а не
 * правкой сотен классов. Скрипт показывает, что из этого выйдет, ДО правки:
 * подставляет размер прямо в браузере и снимает экран.
 *
 * Запуск (нужен работающий npm run dev и пароль в PW_OWNER):
 *   node scripts/scale-preview.mjs /dashboard 16 17 18
 */
import fs from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.CHECK_BASE ?? "http://localhost:3000";
const EMAIL = process.env.CHECK_EMAIL ?? "a.firstov@colizeum.ru";
const PASSWORD = process.env.PW_OWNER ?? process.env.CHECK_PASSWORD;
const OUT = process.env.SCALE_OUT ?? "/tmp";

const [pathArg, ...sizes] = process.argv.slice(2);
const PAGE = pathArg ?? "/dashboard";
const SIZES = (sizes.length ? sizes : ["16", "17", "18"]).map(Number);

if (!PASSWORD) {
  console.error("Нужен пароль: PW_OWNER=… node scripts/scale-preview.mjs");
  process.exit(1);
}

const launch = {};
if (fs.existsSync("/opt/pw-browsers/chromium")) launch.executablePath = "/opt/pw-browsers/chromium";
const browser = await chromium.launch(launch);
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("input[type=password]", { timeout: 60_000 });
await page.fill("input[type=email]", EMAIL);
await page.fill("input[type=password]", PASSWORD);
for (let i = 1; i <= 3 && page.url().includes("/login"); i++) {
  await page.click("button[type=submit]").catch(() => {});
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30_000 }).catch(() => {});
}
await page.getByRole("button", { name: "Понятно" }).click({ timeout: 2000 }).catch(() => {});

for (const size of SIZES) {
  await page.goto(BASE + PAGE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1800);
  // Базовый размер шрифта тянет за собой всю вёрстку: в Tailwind и отступы,
  // и радиусы, и высоты заданы в rem.
  await page.addStyleTag({ content: `html { font-size: ${size}px !important; }` });
  await page.waitForTimeout(700);
  const name = `${OUT}/scale-${PAGE.replace(/\W+/g, "-").replace(/^-|-$/g, "") || "page"}-${size}.jpg`;
  await page.screenshot({ path: name, type: "jpeg", quality: 78 });
  console.log(`✓ ${size}px → ${name}`);
}

await browser.close();
