/**
 * Проверка доступности провайдеров ИИ с этого компьютера.
 * Запуск: npm run ai:scan
 *
 * Ключи не нужны: мы лишь смотрим, отвечает ли сервер вообще. Ответ 401
 * («нет ключа») — это ХОРОШО: значит связь есть и провайдера можно подключать.
 * Обрыв соединения означает, что домен режет сеть или провайдер интернета.
 */

const TARGETS: { name: string; url: string; env: string }[] = [
  { name: "Kimi (Moonshot)", url: "https://api.moonshot.ai/v1/models", env: 'AI_PROVIDER=kimi' },
  { name: "Kimi (Китай)", url: "https://api.moonshot.cn/v1/models", env: 'AI_PROVIDER=kimi + AI_BASE_URL=https://api.moonshot.cn/v1' },
  { name: "Qwen (DashScope общий)", url: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/models", env: "AI_PROVIDER=qwen" },
  { name: "DeepSeek", url: "https://api.deepseek.com/models", env: "AI_PROVIDER=deepseek" },
  { name: "GigaChat (Сбер)", url: "https://gigachat.devices.sberbank.ru/api/v1/models", env: "требует отдельной авторизации" },
  { name: "YandexGPT", url: "https://llm.api.cloud.yandex.net/v1/models", env: "AI_PROVIDER=yandex (модель: gpt://<каталог>/yandexgpt/latest)" },
  { name: "Anthropic (Claude)", url: "https://api.anthropic.com/v1/models", env: "AI_PROVIDER=anthropic" },
  { name: "OpenAI", url: "https://api.openai.com/v1/models", env: 'AI_PROVIDER=openai + AI_BASE_URL=https://api.openai.com/v1' },
];

async function probe(url: string): Promise<{ ok: boolean; note: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Authorization: "Bearer probe" } });
    return { ok: true, note: `отвечает (код ${res.status})` };
  } catch (e) {
    const cause = (e as { cause?: { code?: string } })?.cause;
    const code = cause?.code ?? (e instanceof Error && e.name === "AbortError" ? "TIMEOUT" : "");
    const human: Record<string, string> = {
      ECONNRESET: "соединение обрывают (похоже на блокировку)",
      ETIMEDOUT: "нет ответа (блокировка или сеть)",
      TIMEOUT: "нет ответа за 12 секунд",
      ENOTFOUND: "домен не найден в DNS",
      ECONNREFUSED: "соединение отклонено",
      UND_ERR_CONNECT_TIMEOUT: "не удалось соединиться",
    };
    return { ok: false, note: human[code] ?? code ?? "не удалось соединиться" };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  console.log("Проверяю, до каких провайдеров ИИ достаёт ваша сеть.");
  console.log("Ответ «отвечает» — годится, даже если код 401: значит связь есть.\n");

  const available: string[] = [];
  for (const t of TARGETS) {
    const r = await probe(t.url);
    console.log(`${r.ok ? "✅" : "❌"}  ${t.name.padEnd(24)} ${r.note}`);
    if (r.ok) available.push(`${t.name} → ${t.env}`);
  }

  console.log("");
  if (available.length === 0) {
    console.log("Ни один провайдер не отвечает. Варианты: включить VPN на этом компьютере");
    console.log("или запускать сервис на зарубежном сервере — тогда ИИ заработает у всех сотрудников.");
    return;
  }
  console.log("Доступны и годятся для подключения:");
  for (const a of available) console.log("  •", a);
  console.log("\nВыберите один, впишите настройки в .env и запустите: npm run ai:check");
}

main();
