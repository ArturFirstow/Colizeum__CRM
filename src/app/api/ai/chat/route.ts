import { NextRequest } from "next/server";
import { withSession, ok, fail } from "@/lib/api";
import { aiChat, aiConfigured, AI_NO_KEY_MESSAGE, aiErrorMessage, type AiMessage } from "@/lib/ai";
import { aiTools, makeRunTool, describeToolStep } from "@/lib/ai-tools";
import { SERVICE_MAP } from "@/lib/ai-service-map";
import { buildAiContext } from "@/lib/ai-context";
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
      const context = await buildAiContext(session);
      const result = await aiChat({
        system: [
          "Ты — напарник менеджера в сервисе Colizeum Agency. Ты работаешь ВНУТРИ этого сервиса и",
          "имеешь доступ к его данным через инструменты. Ты не просто отвечаешь на вопросы — ты",
          "находишь нужное в картотеке и раскладываешь входящее по разделам.",
          "",
          "## Как отвечать",
          "- По-русски, коротко, в Markdown. Без вступлений вроде «Конечно!» и без пересказа вопроса.",
          "- Никогда не выдумывай клиентов, суммы, даты, документы и правила. Всё, чего не вернули",
          "  инструменты и чего нет в тексте ниже, — ты не знаешь. Так и говори: «этого в сервисе нет».",
          "- Если не хватает одной детали — задай ОДИН короткий уточняющий вопрос, не больше.",
          "- Если ты что-то изменил в сервисе — последней строкой перечисли, что именно сделал.",
          "",
          "## Когда какой инструмент вызывать (сначала инструмент, потом ответ)",
          "- Спрашивают про клиента, сделку, сумму, срок, задачу → get_client или list_my_clients.",
          "- Спрашивают, как у нас принято работать: цены, договоры, форматы, ОРД, промокоды,",
          "  реквизиты, шаблоны → search_knowledge. По памяти на такие вопросы не отвечай.",
          "- Упомянут присланный файл, счёт, макет, медиаплан, договор → list_inbox_files, затем",
          "  определи клиента и разложи через route_file. Если клиент неочевиден — переспроси.",
          "- Из разговора следует действие со сроком → create_task.",
          "- Прислали итог встречи или расшифровку → add_journal_entry.",
          "- Новость дня по проекту → add_daily_status.",
          "- Решение вне полномочий сотрудника (скидка, доступ, деньги) → ask_leader.",
          "",
          SERVICE_MAP,
          "",
          context,
        ].join("\n"),
        messages: aiMessages,
        tools: aiTools,
        runTool: makeRunTool(session),
        maxTokens: 2200,
        maxSteps: 8,
      });

      // Показываем сотруднику, куда напарник реально заглянул. Если список
      // пуст — он отвечал по памяти, и такому ответу верить нельзя.
      const steps = result.steps.map((s) => describeToolStep(s.name, s.input));
      console.log(
        `[напарник] ${session.name}: «${aiMessages[aiMessages.length - 1]?.content.slice(0, 60)}» → ` +
          (steps.length > 0 ? steps.join(" → ") : "БЕЗ обращения к данным"),
      );
      return ok({ reply: result.text, html: renderMarkdown(result.text), steps });
    } catch (e) {
      return fail("ai_failed", aiErrorMessage(e), 502);
    }
  });
}
