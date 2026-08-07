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
  deepseek: "https://api.deepseek.com/v1",
  yandex: "https://llm.api.cloud.yandex.net/v1",
  qwen: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
  kimi: "https://api.moonshot.ai/v1",
};
const PRESET_MODEL: Record<string, string> = {
  deepseek: "deepseek-chat",
  yandex: "",
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

  // Новые ключи Alibaba (sk-ws-…) привязаны к своей рабочей области и ходят
  // на выделенный домен. Общий адрес dashscope для них не работает.
  if (key.startsWith("sk-ws-") && /dashscope/i.test(baseUrl)) {
    console.log("⚠️  У вашего ключа (sk-ws-…) выделенный домен рабочей области,");
    console.log("   а в AI_BASE_URL указан общий адрес dashscope. Скорее всего, не пройдёт.");
    console.log("   Возьмите адрес из карточки ключа в консоли — строка");
    console.log("   «Совместимая конечная точка OpenAI», вида:");
    console.log("   https://ws-XXXXXXXX.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1\n");
  }
  if (provider === "qwen" && !baseUrl) {
    console.log("⚠️  Не задан AI_BASE_URL. Для ключей sk-ws-… он обязателен — возьмите его в карточке ключа.\n");
  }

  if (provider === "yandex" && !model.startsWith("gpt://")) {
    console.log("⚠️  Для YandexGPT модель пишется целиком, вместе с каталогом:");
    console.log('   AI_MODEL="gpt://ваш-идентификатор-каталога/yandexgpt/latest"');
    console.log("   Идентификатор каталога виден в консоли Yandex Cloud.\n");
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
      headers: {
        "Content-Type": "application/json",
        Authorization: provider === "yandex" ? `Api-Key ${key}` : `Bearer ${key}`,
      },
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
      console.log("• Проверьте AI_BASE_URL: для ключей sk-ws-… нужен адрес из карточки ключа");
      console.log("  («Совместимая конечная точка OpenAI»), а не общий dashscope.");
      console.log("• Точное имя модели смотрите в кабинете и пропишите AI_MODEL.");
    } else if (res.status === 429) {
      console.log("Причина: лимит или нет средств на балансе провайдера.");
    }
  } catch (e) {
    // fetch failed прячет настоящую причину в cause — достаём её.
    const cause = (e as { cause?: { code?: string; message?: string; errno?: number } })?.cause;
    const code = cause?.code ?? "";
    console.log("\n❌ Запрос не дошёл до провайдера:", e instanceof Error ? e.message : String(e));
    if (cause) console.log("   Причина внутри:", code || cause.message || JSON.stringify(cause).slice(0, 200));
    console.log("");

    const host = (() => {
      try {
        return new URL(baseUrl).hostname;
      } catch {
        return baseUrl;
      }
    })();

    if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
      console.log("Домен не удалось найти в DNS — компьютер не знает, где этот сервер.");
      console.log(`Проверьте в PowerShell:  nslookup ${host}`);
      console.log("Если DNS не отвечает, помогает смена DNS на 1.1.1.1 или 8.8.8.8, либо VPN.");
    } else if (code === "ECONNREFUSED" || code === "ECONNRESET" || code === "ETIMEDOUT" || code === "UND_ERR_CONNECT_TIMEOUT") {
      console.log("Домен нашёлся, но соединение не установилось — его режет сеть, фаервол или провайдер.");
      console.log(`Проверьте в PowerShell:  Test-NetConnection ${host} -Port 443`);
      console.log("Если соединения нет — нужен VPN на этом компьютере либо запуск сервиса на зарубежном сервере.");
    } else if (code.includes("CERT") || code.includes("TLS") || code.includes("SSL")) {
      console.log("Проблема с сертификатом — обычно так делает антивирус или корпоративный фильтр трафика.");
      console.log("Попробуйте временно отключить проверку HTTPS в антивирусе.");
    } else {
      console.log(`Быстрая проверка доступности:  Test-NetConnection ${host} -Port 443`);
      console.log("И откройте адрес в браузере — если и там не грузится, дело в сети, а не в ключе.");
    }
  }
}

main();
