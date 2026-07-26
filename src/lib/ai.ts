import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// ─────────────────────────────────────────────────────────────────────────────
// Единый шов для ИИ. Сейчас провайдер — Claude (Anthropic).
// ВСЕ ИИ-вызовы сервиса идут через aiComplete(), поэтому сменить провайдера
// позже = переписать только этот файл (например, на OpenAI-совместимый клиент
// для Gemini/Groq/DeepSeek), не трогая функции-фичи и UI.
//
// Ключ: ANTHROPIC_API_KEY в .env. Модель — AI_MODEL (по умолчанию claude-opus-4-8).
// ─────────────────────────────────────────────────────────────────────────────

const MODEL = process.env.AI_MODEL ?? "claude-opus-4-8";

/** Есть ли ключ для ИИ. */
export function aiConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

/** Понятное сообщение, если ключ не задан. */
export const AI_NO_KEY_MESSAGE =
  'ИИ не подключён: не задан ANTHROPIC_API_KEY. Добавьте ключ в .env (строка ANTHROPIC_API_KEY="sk-ant-…") и перезапустите сервер.';

/** Один вызов ИИ: system-инструкция + пользовательский контекст → текст. */
export async function aiComplete(opts: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string> {
  const client = new Anthropic(); // читает ANTHROPIC_API_KEY из окружения
  const res = await client.messages.create({
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
