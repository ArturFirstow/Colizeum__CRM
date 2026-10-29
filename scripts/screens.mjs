// Снимки экранов для обучающего руководства.
// Запуск: node shots.mjs  (нужен работающий npm run dev)
import fs from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";

const BASE = "http://localhost:3000";
const OUT = "/home/user/Colizeum__CRM/docs/screens";
const PW = {
  owner: process.env.PW_OWNER,
  manager: process.env.PW_MANAGER,
  director: process.env.PW_DIRECTOR,
};

fs.mkdirSync(OUT, { recursive: true });
// Браузер берём установленный в окружении: версия playwright из npm может
// просить свою сборку, которой на машине нет.
const launch = {};
if (process.env.CHECK_BROWSER) launch.executablePath = process.env.CHECK_BROWSER;
else if (fs.existsSync("/opt/pw-browsers/chromium")) launch.executablePath = "/opt/pw-browsers/chromium";
const browser = await chromium.launch(launch);

// Снимок делается в двух видах:
//   name.jpg      — вся страница до maxH, для чтения в руководстве-странице;
//   name@deck.jpg — верхние 900 точек, ровно 16:10, для слайда презентации
//                   (иначе длинные страницы на слайде сжимаются в узкую полоску).
async function shot(page, name, maxH = 1500) {
  await page.waitForTimeout(700);
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  const buf = await page.screenshot({
    type: "jpeg",
    quality: 72,
    clip: { x: 0, y: 0, width: 1440, height: Math.max(600, Math.min(h, maxH)) },
  });
  fs.writeFileSync(path.join(OUT, name + ".jpg"), buf);
  const deck = await page.screenshot({
    type: "jpeg",
    quality: 74,
    clip: { x: 0, y: 0, width: 1440, height: 900 },
  });
  fs.writeFileSync(path.join(OUT, name + "@deck.jpg"), deck);
  console.log("✓", name, `${buf.length / 1024 | 0} КБ`);
}

async function session(email, password, device) {
  const ctx = await browser.newContext(
    device ? { ...devices[device] } : { viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 },
  );
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("  [ошибка страницы]", e.message.slice(0, 120)));
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  return { ctx, page, email, password };
}

async function login(s, { shotLogin } = {}) {
  const { page } = s;
  await page.waitForSelector("input[type=password]", { timeout: 60_000 });
  await page.fill("input[type=email]", s.email);
  await page.fill("input[type=password]", s.password);
  if (shotLogin) await shot(page, "login", 1000);
  // Иногда первая отправка уходит в пустоту (dev-сервер дособирает страницу) —
  // поэтому даём две попытки и ждём не ответ, а смену адреса.
  for (let attempt = 1; attempt <= 3 && page.url().includes("/login"); attempt++) {
    await page.click("button[type=submit]").catch(() => {});
    await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30_000 }).catch(() => {});
    if (page.url().includes("/login")) await page.waitForTimeout(2000);
  }
  await page.waitForTimeout(2500);
  // Экран согласия с документами при первом входе — он не отдельный адрес, а
  // окно поверх страницы, поэтому ищем его по заголовку.
  const gate = page.getByText("Прежде чем начать");
  if (await gate.count()) {
    if (!fs.existsSync(path.join(OUT, "consent.jpg"))) await shot(page, "consent", 1050);
    const boxes = page.locator("input[type=checkbox]");
    const n = await boxes.count();
    for (let i = 0; i < n; i++) await boxes.nth(i).check();
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: /Принять и продолжить/ }).click();
    await page.waitForTimeout(2500);
  }
  // Плашка про cookie закрывает низ страницы — убираем, иначе она попадёт
  // на каждый снимок.
  await page.getByRole("button", { name: "Понятно" }).click({ timeout: 2000 }).catch(() => {});
  await page.waitForTimeout(500);
  if (page.url().includes("/login")) {
    const msg = await page.locator("form").innerText().catch(() => "");
    console.log("  [страница входа ответила]", msg.replace(/\s+/g, " ").slice(0, 200));
    throw new Error(
      `Не удалось войти под ${s.email}. Проверьте пароль в переменных PW_* ` +
        "(в демо-базе его можно задать: npx tsx scripts/set-password.ts <почта> \"пароль\").",
    );
  }
  console.log("вошли:", s.email, "→", page.url());
}

async function go(page, url, name, maxH) {
  await page.goto(BASE + url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1800);
  await shot(page, name, maxH);
}

async function firstHref(page, list, prefix) {
  await page.goto(BASE + list, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  return page.locator(`a[href^="${prefix}"]`).first().getAttribute("href").catch(() => null);
}

// ─── Артур: руководитель проектов (Owner) ────────────────────────────────────
const a = await session("a.firstov@colizeum.ru", PW.owner);
await login(a, { shotLogin: true });

await go(a.page, "/dashboard", "dashboard", 1700);
await go(a.page, "/tasks", "tasks", 1300);
// Имя снимка оставлено прежним («worksheet»): на него ссылается
// scripts/gen-training.js. Сам раздел стал видом внутри «Задач».
await go(a.page, "/tasks?view=clients", "worksheet", 1800);
await go(a.page, "/deals", "deals", 1300);
await go(a.page, "/advertisers", "advertisers", 1200);
await go(a.page, "/documents", "documents", 1400);
await go(a.page, "/placements", "placements", 1200);
await go(a.page, "/finances", "finances", 1200);
await go(a.page, "/ord", "ord", 1100);
await go(a.page, "/promo", "promo", 1100);
await go(a.page, "/journal", "journal", 1300);
await go(a.page, "/knowledge", "knowledge", 1300);
await go(a.page, "/leads", "leads", 1100);
await go(a.page, "/assistant", "assistant", 1100);
await go(a.page, "/handover", "handover", 1700);
await go(a.page, "/team", "team", 1800);
await go(a.page, "/messenger", "messenger", 1000);

// карточки
const dealHref = await firstHref(a.page, "/deals", "/deals/");
if (dealHref) {
  await go(a.page, dealHref, "deal-card", 1900);
  // полоса стадий крупно
  const line = a.page.locator("text=Лид").first();
  if (await line.count()) {
    const box = await line.boundingBox().catch(() => null);
    if (box) {
      const buf = await a.page.screenshot({
        type: "jpeg",
        quality: 80,
        clip: { x: 0, y: Math.max(0, box.y - 120), width: 1440, height: 320 },
      });
      fs.writeFileSync(path.join(OUT, "deal-stages.jpg"), buf);
      console.log("✓ deal-stages");
    }
  }
  // запрос юристу
  const btn = a.page.getByRole("button", { name: /Запрос юристу/ }).first();
  if (await btn.count()) {
    await btn.click();
    await a.page.waitForTimeout(1500);
    await shot(a.page, "legal-request", 1400);
    await a.page.keyboard.press("Escape");
  }
}
const advHref = await firstHref(a.page, "/advertisers", "/advertisers/");
if (advHref) await go(a.page, advHref, "advertiser-card", 1900);

// меню профиля
await a.page.goto(BASE + "/dashboard", { waitUntil: "domcontentloaded" });
await a.page.waitForTimeout(1500);
const avatar = a.page.locator("aside button").last();
if (await avatar.count()) {
  await avatar.click().catch(() => {});
  await a.page.waitForTimeout(900);
  await shot(a.page, "profile-menu", 1000);
}
await a.ctx.close();

// ─── Екатерина: проектный менеджер ───────────────────────────────────────────
if (PW.manager) {
  const k = await session("e.turinova@colizeum.ru", PW.manager);
  await login(k);
  await go(k.page, "/tasks?view=clients", "worksheet-manager", 1800);
  await go(k.page, "/dashboard", "dashboard-manager", 1500);
  await k.ctx.close();
}

// ─── Александр: руководитель отдела ──────────────────────────────────────────
if (PW.director) {
  const d = await session("a.ivanushkin@colizeum.ru", PW.director);
  await login(d);
  await go(d.page, "/leadership", "leadership", 1700);
  await go(d.page, "/leadership/budget", "leadership-budget", 1600);
  await d.ctx.close();
}

// ─── телефон ─────────────────────────────────────────────────────────────────
{
  const m = await session("a.firstov@colizeum.ru", PW.owner, "iPhone 13");
  await login(m);
  await m.page.goto(BASE + "/dashboard", { waitUntil: "domcontentloaded" });
  await m.page.waitForTimeout(2000);
  const buf = await m.page.screenshot({ type: "jpeg", quality: 75 });
  fs.writeFileSync(path.join(OUT, "mobile-dashboard.jpg"), buf);
  console.log("✓ mobile-dashboard");
  await m.ctx.close();
}

await browser.close();
console.log("готово");
