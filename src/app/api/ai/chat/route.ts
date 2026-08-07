import { NextRequest } from "next/server";
import { withSession, ok, fail } from "@/lib/api";
import { aiChat, aiConfigured, AI_NO_KEY_MESSAGE, aiErrorMessage, type AiMessage } from "@/lib/ai";
import { aiTools, makeRunTool } from "@/lib/ai-tools";
import { renderMarkdown } from "@/lib/markdown";
import { z } from "zod";

const schema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .min(1)
    .max(40),
});

// Напарник ИИ: читает кабинет сотрудника и раскладывает входящее по разделам.
export async function POST(req: NextRequest) {
  return withSession(async (session) => {
    if (!aiConfigured()) return fail("no_api_key", AI_NO_KEY_MESSAGE, 400);
    const { messages } = schema.parse(await req.json());
    const aiMessages: AiMessage[] = messages.map((m) => ({ role: m.role, content: m.content }));

    try {
      const text = await aiChat({
      system:
        "Ты — напарник сотрудника Colizeum Agency (агентство рекламы и коллабораций для сети киберклубов COLIZEUM). " +
        "Ты не просто отвечаешь — ты РАСКЛАДЫВАЕШЬ информацию по сервису, как картотека. " +
        "Отвечай кратко и по-русски, в Markdown.\n\n" +
        "Порядок работы:\n" +
        "1. Если сотрудник прислал файл или упомянул вложение — сначала вызови list_inbox_files.\n" +
        "2. Пойми по имени файла и по словам сотрудника, что это (счёт, макет, медиаплан, договор) и к какому клиенту относится. " +
        "Если клиент неочевиден — вызови list_my_clients и спроси коротким уточняющим вопросом, не выдумывай.\n" +
        "3. Разложи файл через route_file и скажи, куда именно он лёг.\n" +
        "4. Если из текста следует действие со сроком — поставь задачу через create_task. " +
        "Если это итог встречи — сохрани через add_journal_entry. " +
        "Если по проекту есть новость дня — add_daily_status. " +
        "Если решение вне полномочий сотрудника — ask_leader.\n" +
        "5. В конце одной строкой перечисли, что именно ты сделал.\n\n" +
        "Никогда не выдумывай клиентов, суммы и документы — только то, что вернули инструменты. " +
        "Правила домена: приложения Т-Банка согласуются строго по очереди; правки после подписания при запрете правки тела — через ДС; " +
        "размещение стартует только после предоплаты; НДС по дате документа 2025→20%, 2026→22%.",
      messages: aiMessages,
      tools: aiTools,
      runTool: makeRunTool(session),
        maxTokens: 2200,
        maxSteps: 8,
      });
      return ok({ reply: text, html: renderMarkdown(text) });
    } catch (e) {
      return fail("ai_failed", aiErrorMessage(e), 502);
    }
  });
}
