/**
 * Проверка «а на телефоне не разъехалось?».
 *
 * Открывает разделы сервиса в браузере с профилем iPhone 13 и сравнивает
 * ширину содержимого с шириной экрана. Если содержимое шире — страницу
 * придётся прокручивать боком, а это первое, что замечают с телефона.
 *
 * ЗАЧЕМ ОТДЕЛЬНАЯ ПРОВЕРКА. Разъезжается не вся страница, а один блок:
 * длинное название клиента, сумма с НДС, имя файла. Глазами на компьютере
 * этого не видно вовсе, а на телефоне видно сразу.
 *
 * ⚠️ Чаще всего виноват один и тот же недосмотр: ребёнок grid или flex по
 * умолчанию НЕ сжимается меньше своего содержимого. Там, где внутри стоит
 * `truncate`, родителю нужен `min-w-0` — иначе длинная строка растягивает
 * колонку, а вместе с ней всю страницу.
 *
 * Запуск (нужен работающий сервер и установленный playwright):
 *   npm run dev                       # в одном окне
 *   node scripts/mobile-check.mjs     # в другом
 *
 * Playwright в зависимости проекта не входит намеренно — он тянет браузеры
 * на сотни мегабайт, а проверка нужна изредка. Нет его — скрипт скажет, что
 * поставить. Логин берётся из переменных CHECK_EMAIL / CHECK_PASSWORD.
 */
const BASE = process.env.CHECK_BASE ?? "http://localhost:3000";
const EMAIL = process.env.CHECK_EMAIL ?? "a.firstov@colizeum.ru";
const PASSWORD = process.env.CHECK_PASSWORD;

const PAGES = [
  "/dashboard",
  "/tasks",
  "/deals",
  "/advertisers",
  "/documents",
  "/finances",
  "/placements",
  "/ord",
  "/promo",
  "/knowledge",
  "/leads",
  "/journal",
  "/handover",
  "/team",
  "/messenger",
];

let pw;
try {
  pw = await import("playwright");
} catch {
  console.error(
    "Нужен playwright. Поставьте его разово: npm i --no-save playwright\n" +
      "Браузер в этом окружении уже есть — путь к нему берётся из PLAYWRIGHT_BROWSERS_PATH.",
  );
  process.exit(1);
}

if (!PASSWORD) {
  console.error("Не задан CHECK_PASSWORD — пароль сотрудника, под которым смотрим страницы.");
  process.exit(1);
}

const { chromium, devices } = pw;
const launch = {};
if (process.env.CHECK_BROWSER) launch.executablePath = process.env.CHECK_BROWSER;

const browser = await chromium.launch(launch);
const context = await browser.newContext({ ...devices["iPhone 13"] });
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.fill("input[type=email]", EMAIL);
await page.fill("input[type=password]", PASSWORD);
await Promise.all([
  page.waitForResponse((r) => r.url().includes("/api/auth/login"), { timeout: 120_000 }),
  page.click("button[type=submit]"),
]);
await page.waitForTimeout(3000);

let wide = 0;
for (const path of PAGES) {
  await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
  // Мессенджер держит открытое соединение и не отдаёт networkidle — ждём по часам.
  await page.waitForTimeout(2200);
  const m = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    screen: window.screen.width,
  }));
  const ok = m.doc <= m.screen + 1;
  if (!ok) wide++;
  console.log(`${path.padEnd(22)} ${m.doc} / ${m.screen} → ${ok ? "ок" : "ШИРЕ ЭКРАНА"}`);
}

// Карточки отдельной сделки и отдельного клиента — самые плотные страницы
// сервиса, и ломались именно они, пока проверка смотрела только списки.
// Идентификаторы не вписываем: берём первую ссылку из списка.
let cards = 0;
for (const [list, prefix] of [
  ["/deals", "/deals/"],
  ["/advertisers", "/advertisers/"],
]) {
  await page.goto(BASE + list, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const href = await page
    .locator(`a[href^="${prefix}"]`)
    .first()
    .getAttribute("href")
    .catch(() => null);
  if (!href) {
    console.log(`${list.padEnd(22)} карточек нет — проверять нечего`);
    continue;
  }
  await page.goto(BASE + href, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const m = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    screen: window.screen.width,
  }));
  const ok = m.doc <= m.screen + 1;
  if (!ok) wide++;
  cards++;
  console.log(`${`карточка ${list}`.padEnd(22)} ${m.doc} / ${m.screen} → ${ok ? "ок" : "ШИРЕ ЭКРАНА"}`);
}

console.log(
  `\nПроверено: ${PAGES.length} разделов и ${cards} карточки. Шире экрана: ${wide}. ` +
    `Ошибок страниц: ${pageErrors.length ? pageErrors.slice(0, 2).join(" | ") : "нет"}`,
);
await browser.close();
process.exit(wide === 0 ? 0 : 1);
