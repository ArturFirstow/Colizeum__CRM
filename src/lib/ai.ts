import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// ─────────────────────────────────────────────────────────────────────────────
// Единый шов для ИИ. Провайдер выбирается в .env одной строкой AI_PROVIDER:
//
//   deepseek  — DeepSeek (OpenAI-совместимый, доступен из РФ)
//   yandex    — YandexGPT (данные остаются в РФ; модель задаётся как
//               gpt://<идентификатор-каталога>/yandexgpt/latest)
//   qwen      — Alibaba Qwen (DashScope, OpenAI-совместимый)
//   kimi      — Moonshot Kimi (OpenAI-совместимый)
//   openai    — любой другой OpenAI-совместимый сервис (адрес в AI_BASE_URL)
//   anthropic — Claude (нужен доступ из вашей страны)
//
// Остальной код сервиса — напарник, его инструменты, кнопки «Саммари» и
// «Драфт ДС» — не знает, какой провайдер стоит: всё идёт через aiComplete()
// и aiChat(). Смена провайдера = правка .env, код не трогаем.
// ─────────────────────────────────────────────────────────────────────────────

type Provider = "deepseek" | "yandex" | "qwen" | "kimi" | "openai" | "anthropic";

const PROVIDER = (process.env.AI_PROVIDER ?? "anthropic").toLowerCase() as Provider;

// Адреса OpenAI-совместимых API (переопределяются через AI_BASE_URL).
const PRESET_BASE_URL: Partial<Record<Provider, string>> = {
  deepseek: "https://api.deepseek.com/v1",
  yandex: "https://llm.api.cloud.yandex.net/v1",
  qwen: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
  kimi: "https://api.moonshot.ai/v1",
};

// Модель по умолчанию. Точное название смотрите в кабинете провайдера
// и при необходимости задайте своё через AI_MODEL.
const PRESET_MODEL: Record<Provider, string> = {
  deepseek: "deepseek-chat",
  // У Яндекса модель указывается вместе с каталогом, поэтому значение
  // по умолчанию бессмысленно — его обязательно задаёт AI_MODEL.
  yandex: "",
  qwen: "qwen-plus",
  kimi: "moonshot-v1-32k",
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-5",
};

const MODEL = process.env.AI_MODEL || PRESET_MODEL[PROVIDER] || "qwen-plus";
const BASE_URL = process.env.AI_BASE_URL || PRESET_BASE_URL[PROVIDER];

// Насколько модели позволено «фантазировать». По умолчанию у провайдеров стоит
// 1.0 — это режим свободной беседы, из-за которого напарник придумывает клиентов
// и суммы вместо того, чтобы смотреть в данные. Нам нужен помощник-педант,
// поэтому держим низкую температуру. Переопределяется через AI_TEMPERATURE.
const TEMPERATURE = Number(process.env.AI_TEMPERATURE ?? 0.2);

/** Ключ провайдера: общий AI_API_KEY либо прежний ANTHROPIC_API_KEY. */
function apiKey(): string | undefined {
  return process.env.AI_API_KEY || process.env.ANTHROPIC_API_KEY || undefined;
}

/** Есть ли ключ для ИИ. */
export function aiConfigured(): boolean {
  return !!apiKey();
}

/** Понятное сообщение, если ключ не задан. */
export const AI_NO_KEY_MESSAGE =
  'ИИ не подключён: не задан ключ. Добавьте в .env строки AI_PROVIDER="qwen" (или kimi) и AI_API_KEY="…", затем перезапустите сервер.';

/** Переводим технические ошибки провайдера в понятные человеку. */
export function aiErrorMessage(e: unknown): string {
  const status = (e as { status?: number })?.status;
  const raw = e instanceof Error ? e.message : String(e);
  if (status === 403 || /request not allowed|forbidden/i.test(raw)) {
    return (
      "Провайдер ИИ отклонил запрос (403) — обычно это значит, что обращения из вашей страны не принимаются. " +
      "Ключ при этом рабочий. Смените провайдера в .env (AI_PROVIDER=qwen или kimi) либо запускайте сервис на зарубежном сервере."
    );
  }
  if (status === 401) {
    return "Провайдер ИИ не принял ключ (401): проверьте, что AI_API_KEY скопирован целиком и не отозван в кабинете провайдера.";
  }
  if (status === 404 && /model/i.test(raw)) {
    return `Провайдер не знает модель «${MODEL}». Посмотрите точное название в кабинете провайдера и укажите его в .env строкой AI_MODEL.`;
  }
  if (PROVIDER === "yandex" && !MODEL.startsWith("gpt://")) {
    return 'Для YandexGPT модель задаётся полностью: AI_MODEL="gpt://ваш-идентификатор-каталога/yandexgpt/latest".';
  }
  if (status === 402 || /insufficient|balance|credit|arrears/i.test(raw)) {
    return "На счёте у провайдера ИИ нет средств — ключ рабочий, нужно пополнить баланс в кабинете провайдера.";
  }
  if (status === 429) return "Провайдер ИИ перегружен или исчерпан лимит (429). Попробуйте через минуту или проверьте баланс.";
  return `Ошибка ИИ: ${raw}`;
}

// ── Нейтральные типы: одинаковые для всех провайдеров ────────────────────────
export type AiTool = {
  name: string;
  description: string;
  /** JSON Schema параметров инструмента. */
  input_schema: Record<string, unknown>;
};
export type AiMessage = { role: "user" | "assistant"; content: string };

const isAnthropic = () => PROVIDER === "anthropic";

// OpenAI-совместимый запрос делаем обычным fetch — отдельная библиотека
// не нужна, а значит и нечему ломаться при установке зависимостей.
type ChatMsg = Record<string, unknown>;

async function chatCompletion(body: Record<string, unknown>): Promise<Record<string, any>> {
  const url = `${(BASE_URL ?? "").replace(/\/$/, "")}/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Яндекс принимает ключ как «Api-Key», остальные — как «Bearer».
      Authorization: PROVIDER === "yandex" ? `Api-Key ${apiKey() ?? ""}` : `Bearer ${apiKey() ?? ""}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(text.slice(0, 500)) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Провайдер вернул не JSON: " + text.slice(0, 200));
  }
}

function anthropicClient() {
  return new Anthropic({ apiKey: apiKey() ?? "", baseURL: process.env.AI_BASE_URL || undefined });
}

// ── Один вызов: инструкция + текст → ответ ───────────────────────────────────
export async function aiComplete(opts: { system: string; user: string; maxTokens?: number }): Promise<string> {
  if (isAnthropic()) {
    const res = await anthropicClient().messages.create({
      model: MODEL,
      max_tokens: opts.maxTokens ?? 3000,
      temperature: TEMPERATURE,
      system: opts.system,
      messages: [{ role: "user", content: opts.user }],
    });
    return res.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("\n")
      .trim();
  }

  const res = await chatCompletion({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 3000,
    temperature: TEMPERATURE,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
  });
  return String(res.choices?.[0]?.message?.content ?? "").trim();
}

// ── Диалог с инструментами: ИИ сам решает, что вызвать ───────────────────────
/** Что вернул диалог: текст ответа и список инструментов, которые ИИ вызвал.
 *  Список нужен, чтобы сотрудник видел, смотрел ли напарник в данные сервиса
 *  или сочинил ответ из головы. */
export type AiChatResult = { text: string; steps: ToolStep[] };
export type ToolStep = { name: string; input: Record<string, unknown> };

export async function aiChat(opts: {
  system: string;
  messages: AiMessage[];
  tools: AiTool[];
  runTool: (name: string, input: Record<string, unknown>) => Promise<string>;
  maxTokens?: number;
  maxSteps?: number;
}): Promise<AiChatResult> {
  const maxSteps = opts.maxSteps ?? 8;
  return isAnthropic() ? anthropicChat(opts, maxSteps) : openAiChat(opts, maxSteps);
}

type ChatOpts = Parameters<typeof aiChat>[0];

async function anthropicChat(opts: ChatOpts, maxSteps: number): Promise<AiChatResult> {
  const steps: ToolStep[] = [];
  const client = anthropicClient();
  const messages: Anthropic.MessageParam[] = opts.messages.map((m) => ({ role: m.role, content: m.content }));
  const tools = opts.tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  })) as Anthropic.Tool[];

  for (let step = 0; step < maxSteps; step++) {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: opts.maxTokens ?? 2500,
      temperature: TEMPERATURE,
      system: opts.system,
      tools,
      messages,
    });
    messages.push({ role: "assistant", content: res.content });

    if (res.stop_reason !== "tool_use") {
      const text = res.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { text: string }).text)
        .join("\n")
        .trim();
      return { text, steps };
    }

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of res.content) {
      if (block.type === "tool_use") {
        const input = (block.input ?? {}) as Record<string, unknown>;
        steps.push({ name: block.name, input });
        let out: string;
        try {
          out = await opts.runTool(block.name, input);
        } catch (e) {
          out = "Ошибка инструмента: " + (e instanceof Error ? e.message : String(e));
        }
        results.push({ type: "tool_result", tool_use_id: block.id, content: out });
      }
    }
    messages.push({ role: "user", content: results });
  }
  return { text: "Не удалось завершить ответ — слишком много шагов. Уточните вопрос.", steps };
}

async function openAiChat(opts: ChatOpts, maxSteps: number): Promise<AiChatResult> {
  const steps: ToolStep[] = [];
  const messages: ChatMsg[] = [
    { role: "system", content: opts.system },
    ...opts.messages.map((m) => ({ role: m.role, content: m.content })),
  ];
  const tools = opts.tools.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.input_schema },
  }));

  for (let step = 0; step < maxSteps; step++) {
    const res = await chatCompletion({
      model: MODEL,
      max_tokens: opts.maxTokens ?? 2500,
      temperature: TEMPERATURE,
      messages,
      tools,
    });
    const msg = res.choices?.[0]?.message;
    if (!msg) return { text: "Провайдер вернул пустой ответ.", steps };

    const calls: Array<{ id?: string; function?: { name?: string; arguments?: string } }> = msg.tool_calls ?? [];
    if (calls.length === 0) return { text: String(msg.content ?? "").trim(), steps };

    messages.push(msg as ChatMsg);
    for (const call of calls) {
      let out: string;
      let args: Record<string, unknown> = {};
      try {
        args = call.function?.arguments ? (JSON.parse(call.function.arguments) as Record<string, unknown>) : {};
        steps.push({ name: call.function?.name ?? "", input: args });
        out = await opts.runTool(call.function?.name ?? "", args);
      } catch (e) {
        out = "Ошибка инструмента: " + (e instanceof Error ? e.message : String(e));
      }
      messages.push({ role: "tool", tool_call_id: call.id ?? "", content: out });
    }
  }
  return { text: "Не удалось завершить ответ — слишком много шагов. Уточните вопрос.", steps };
}
