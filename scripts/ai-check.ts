/**
 * Проверка подключения ИИ. Запуск: npx tsx scripts/ai-check.ts
 *
 * Делает один самый простой запрос к провайдеру и печатает понятный вердикт:
 * что настроено, куда пошёл запрос и что именно ответил провайдер.
 * Нужен, чтобы не гадать по интерфейсу, где сломалось.
 */
import fs from "node:fs";
import path from "node:path";

// .env читаем сами: скрипт запускается отдельно от Next.
function loadEnv() {
  const file = path.join(process.cwd(), ".env");
  if (!fs.existsSync(file)) {
    console.log("❌ Файл .env не найден в папке проекта.");
    console.log("   Создайте его: скопируйте .env.example и переименуйте в .env");
    process.exit(1);
  }
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let value = t.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

const PRESET_BASE_URL: Record<string, string> = {
  qwen: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
  kimi: "https://api.moonshot.ai/v1",
};
const PRESET_MODEL: Record<string, string> = {
  qwen: "qwen-plus",
  kimi: "moonshot-v1-32k",
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-5",
};

async function main() {
  loadEnv();

  const provider = (process.env.AI_PROVIDER ?? "anthropic").toLowerCase();
  const key = process.env.AI_API_KEY || process.env.ANTHROPIC_API_KEY || "";
  const model = process.env.AI_MODEL || PRESET_MODEL[provider] || "qwen-plus";
  const baseUrl = process.env.AI_BASE_URL || PRESET_BASE_URL[provider] || "";

  console.log("─── Что настроено в .env ───────────────────────────────");
  console.log("Провайдер :", provider || "(не задан)");
  console.log("Модель    :", model);
  console.log("Адрес API :", baseUrl || "(по умолчанию провайдера)");
  console.log("Ключ      :", key ? `${key.slice(0, 8)}…${key.slice(-4)} (длина ${key.length})` : "❌ НЕ ЗАДАН");
  console.log("");

  if (!key) {
    console.log("❌ Ключ не найден. В .env должна быть строка без решётки в начале:");
    console.log('   AI_API_KEY="ваш-ключ"');
    process.exit(1);
  }

  if (provider === "qwen" && !/^sk-[a-f0-9]{20,}$/i.test(key)) {
    console.log("⚠️  Похоже, это не ключ Model Studio (DashScope).");
    console.log("   Рабочий ключ выглядит так: sk- и дальше длинная строка из букв и цифр без точек.");
    console.log("   Где взять: bailian.console.aliyun.com (или Model Studio в консоли Alibaba Cloud) → API-KEY → Create.");
    console.log("   Проверяем всё равно — вдруг формат новый…\n");
  }

  if (provider === "anthropic") {
    console.log("ℹ️  Провайдер anthropic: из России такие запросы обычно отклоняются (403).");
    console.log("   Для Qwen поставьте AI_PROVIDER=\"qwen\".\n");
  }

  const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  console.log("Отправляю тестовый запрос →", url);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        max_tokens: 32,
        messages: [{ role: "user", content: "Ответь одним словом: работает" }],
      }),
    });

    const text = await res.text();
    console.log("Код ответа:", res.status);

    if (res.ok) {
      let answer = "";
      try {
        answer = JSON.parse(text)?.choices?.[0]?.message?.content ?? "";
      } catch {
        /* покажем сырой ответ ниже */
      }
      console.log("\n✅ ПОДКЛЮЧЕНИЕ РАБОТАЕТ. Ответ модели:", answer || text.slice(0, 200));
      console.log("   Можно запускать сервис: npm run dev — напарник заработает.");
      return;
    }

    console.log("\n❌ Провайдер отклонил запрос. Что он ответил:");
    console.log(text.slice(0, 600));
    console.log("");

    if (res.status === 401) {
      console.log("Причина: ключ не принят. Проверьте, что он скопирован целиком и не удалён в кабинете.");
    } else if (res.status === 403) {
      console.log("Причина: доступ запрещён — часто это регион или у ключа нет прав на эту модель.");
    } else if (res.status === 404) {
      console.log("Причина: не найден адрес или модель.");
      console.log("• Если у вас китайская (не international) регистрация, адрес другой — пропишите AI_BASE_URL.");
      console.log("• Точное имя модели смотрите в кабинете и пропишите AI_MODEL.");
    } else if (res.status === 429) {
      console.log("Причина: лимит или нет средств на балансе провайдера.");
    }
  } catch (e) {
    console.log("\n❌ Не удалось достучаться до провайдера:", e instanceof Error ? e.message : String(e));
    console.log("Проверьте интернет на этом компьютере и что адрес в AI_BASE_URL написан верно.");
  }
}

main();
