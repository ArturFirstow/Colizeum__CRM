import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// ─────────────────────────────────────────────────────────────────────────────
// Единый шов для ИИ. Сейчас провайдер — Claude (Anthropic).
// ВСЕ ИИ-вызовы сервиса идут через aiComplete(), поэтому сменить провайдера
// позже = переписать только этот файл (например, на OpenAI-совместимый клиент
// для Gemini/Groq/DeepSeek), не трогая функции-фичи и UI.
//
// Ключ: ANTHROPIC_API_KEY в .env. Модель — AI_MODEL (по умолчанию claude-sonnet-5:
// разумный баланс цены и качества для разбора файлов и ответов по кабинету;
// для самых сложных задач можно поставить claude-opus-5).
// ─────────────────────────────────────────────────────────────────────────────

const MODEL = process.env.AI_MODEL ?? "claude-sonnet-5";

// Адрес API. По умолчанию — напрямую в Anthropic. Если прямые запросы из вашей
// страны не принимаются (ответ 403 «Request not allowed»), сюда можно вписать
// адрес совместимого шлюза/прокси — остальной код менять не нужно.
const BASE_URL = process.env.ANTHROPIC_BASE_URL || undefined;

function client() {
  return new Anthropic({ baseURL: BASE_URL }); // ключ читается из ANTHROPIC_API_KEY
}

/** Есть ли ключ для ИИ. */
export function aiConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

/** Понятное сообщение, если ключ не задан. */
export const AI_NO_KEY_MESSAGE =
  'ИИ не подключён: не задан ANTHROPIC_API_KEY. Добавьте ключ в .env (строка ANTHROPIC_API_KEY="sk-ant-…") и перезапустите сервер.';

/** Переводим технические ошибки провайдера в понятные человеку. */
export function aiErrorMessage(e: unknown): string {
  const status = (e as { status?: number })?.status;
  const raw = e instanceof Error ? e.message : String(e);
  if (status === 403 || /request not allowed/i.test(raw)) {
    return (
      "ИИ отказал в доступе (403): провайдер не принимает запросы из вашего региона. " +
      "Ключ при этом рабочий. Варианты: запускать сервис на зарубежном сервере, " +
      "пустить запросы через шлюз (переменная ANTHROPIC_BASE_URL в .env) " +
      "или подключить провайдера, доступного в РФ."
    );
  }
  if (status === 401) return "ИИ отклонил ключ (401): проверьте, что ANTHROPIC_API_KEY скопирован целиком и не удалён в консоли.";
  if (status === 429) return "ИИ перегружен или исчерпан лимит (429). Попробуйте через минуту или проверьте баланс в консоли.";
  if (status === 400 && /credit|balance/i.test(raw)) return "На счёте Anthropic закончились кредиты — пополните баланс в консоли.";
  return `Ошибка ИИ: ${raw}`;
}

/** Один вызов ИИ: system-инструкция + пользовательский контекст → текст. */
export async function aiComplete(opts: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string> {
  const res = await client().messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 3000,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  });
  return res.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("\n")
    .trim();
}

export type AiTool = Anthropic.Tool;
export type AiMessage = Anthropic.MessageParam;

/**
 * Диалог с инструментами (для ИИ-чата ассистента). ИИ сам решает, какие
 * инструменты вызвать; runTool выполняет их (запросы к БД в области видимости).
 * Промежуточные tool_use/tool_result не возвращаем клиенту — только финальный текст.
 */
export async function aiChat(opts: {
  system: string;
  messages: AiMessage[];
  tools: AiTool[];
  runTool: (name: string, input: Record<string, unknown>) => Promise<string>;
  maxTokens?: number;
  maxSteps?: number;
}): Promise<string> {
  const api = client();
  const messages: AiMessage[] = [...opts.messages];
  const maxSteps = opts.maxSteps ?? 6;

  for (let step = 0; step < maxSteps; step++) {
    const res = await api.messages.create({
      model: MODEL,
      max_tokens: opts.maxTokens ?? 2500,
      system: opts.system,
      tools: opts.tools,
      messages,
    });
    messages.push({ role: "assistant", content: res.content });

    if (res.stop_reason !== "tool_use") {
      return res.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { text: string }).text)
        .join("\n")
        .trim();
    }

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of res.content) {
      if (block.type === "tool_use") {
        let out: string;
        try {
          out = await opts.runTool(block.name, (block.input ?? {}) as Record<string, unknown>);
        } catch (e) {
          out = "Ошибка инструмента: " + (e instanceof Error ? e.message : String(e));
        }
        results.push({ type: "tool_result", tool_use_id: block.id, content: out });
      }
    }
    messages.push({ role: "user", content: results });
  }

  return "Не удалось завершить ответ — слишком много шагов. Уточните вопрос.";
}
