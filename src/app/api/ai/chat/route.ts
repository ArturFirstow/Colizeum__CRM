import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok, fail } from "@/lib/api";
import { ownScope } from "@/lib/scope";
import { aiChat, aiConfigured, AI_NO_KEY_MESSAGE, type AiTool, type AiMessage } from "@/lib/ai";
import { renderMarkdown } from "@/lib/markdown";
import { formatMoney } from "@/lib/format";
import { z } from "zod";

const schema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .min(1)
    .max(40),
});

// Инструменты, которыми ИИ-ассистент читает кабинет сотрудника (только чтение).
const tools: AiTool[] = [
  {
    name: "list_my_clients",
    description: "Список клиентов текущего сотрудника с краткой сводкой (стадия сделок, блокер, следующий шаг). Вызывай, чтобы увидеть портфель или найти нужного клиента.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_client",
    description: "Подробности по одному клиенту: сделки (сумма, стадия, блокер, платежи), статусы дня за последний месяц, открытые задачи. Передай имя клиента (можно часть).",
    input_schema: {
      type: "object",
      properties: { name: { type: "string", description: "Имя клиента или его часть" } },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "search_knowledge",
    description: "Поиск по базе знаний агентства (регламенты, документооборот, форматы, цены, правила). Передай ключевые слова.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "Ключевые слова" } },
      required: ["query"],
      additionalProperties: false,
    },
  },
];

export async function POST(req: NextRequest) {
  return withSession(async (session) => {
    if (!aiConfigured()) return fail("no_api_key", AI_NO_KEY_MESSAGE, 400);
    const { messages } = schema.parse(await req.json());

    const scope = ownScope(session);

    async function runTool(name: string, input: Record<string, unknown>): Promise<string> {
      if (name === "list_my_clients") {
        const advs = await prisma.advertiser.findMany({
          where: { ...scope, archived: false },
          include: { deals: { select: { title: true, stage: true, urgency: true, amount: true, contractTotal: true, blocker: true, nextStep: true } } },
          orderBy: { nameRu: "asc" },
        });
        if (advs.length === 0) return "У сотрудника нет активных клиентов.";
        return advs
          .map((a) => {
            const deals = a.deals.map((d) => `«${d.title}» — ${d.stage}${d.blocker ? `, блокер: ${d.blocker}` : ""}`).join("; ");
            return `- ${a.nameRu}${deals ? `: ${deals}` : " (без сделок)"}`;
          })
          .join("\n");
      }

      if (name === "get_client") {
        const q = String(input.name ?? "").trim();
        if (!q) return "Не передано имя клиента.";
        const a = await prisma.advertiser.findFirst({
          where: { ...scope, nameRu: { contains: q } },
          include: {
            deals: { include: { plannedPayments: true } },
            dailyStatuses: { where: { date: { gte: new Date(Date.now() - 35 * 86400000) } }, orderBy: { date: "asc" } },
            tasks: { where: { status: { not: "Готова" } }, orderBy: { dueDate: "asc" } },
          },
        });
        if (!a) return `Клиент «${q}» не найден среди клиентов сотрудника.`;
        const out: string[] = [`Клиент: ${a.nameRu}${a.legalEntity ? ` (${a.legalEntity})` : ""}`];
        if (a.goals) out.push(`Цель: ${a.goals}`);
        for (const d of a.deals) {
          out.push(
            `Сделка «${d.title}»: стадия ${d.stage}${d.urgency ? `, срочность ${d.urgency}` : ""}` +
              `${d.contractTotal || d.amount ? `, сумма ${formatMoney(d.contractTotal || d.amount)}` : ""}` +
              `${d.blocker ? `; блокер: ${d.blocker}` : ""}${d.nextStep ? `; следующий шаг: ${d.nextStep}` : ""}`,
          );
          for (const p of d.plannedPayments) out.push(`  платёж ${p.periodMonth}: ${formatMoney(p.amount)} — ${p.status}`);
        }
        out.push(`Статусы дня за месяц: ${a.dailyStatuses.map((s) => `${s.date.toISOString().slice(0, 10)} — ${s.text}`).join(" | ") || "нет"}`);
        out.push(`Открытые задачи: ${a.tasks.map((t) => t.title + (t.dueDate ? ` (до ${t.dueDate.toISOString().slice(0, 10)})` : "")).join("; ") || "нет"}`);
        return out.join("\n");
      }

      if (name === "search_knowledge") {
        const q = String(input.query ?? "").trim();
        const arts = await prisma.knowledgeArticle.findMany({
          where: q ? { OR: [{ title: { contains: q } }, { bodyMarkdown: { contains: q } }] } : {},
          take: 5,
        });
        if (arts.length === 0) return `По запросу «${q}» в базе знаний ничего не найдено.`;
        return arts.map((a) => `### ${a.title}\n${a.bodyMarkdown.slice(0, 1200)}`).join("\n\n");
      }

      return `Неизвестный инструмент: ${name}`;
    }

    const aiMessages: AiMessage[] = messages.map((m) => ({ role: m.role, content: m.content }));

    const text = await aiChat({
      system:
        "Ты — ИИ-ассистент сотрудника Colizeum Agency (агентство рекламы и коллабораций для сети киберклубов COLIZEUM). " +
        "Отвечай кратко и по делу НА РУССКОМ, в Markdown. Ты видишь только кабинет этого сотрудника через инструменты — " +
        "используй их, чтобы отвечать по фактам, ничего не выдумывай. " +
        "Если спрашивают про клиента — сначала вызови get_client. Если про портфель/приоритеты — list_my_clients. " +
        "Если про регламент/документы/цены — search_knowledge. " +
        "Правила домена: приложения Т-Банка согласуются строго по очереди; правки после подписания при запрете правки тела — через ДС; " +
        "размещение стартует только после предоплаты; НДС по дате документа 2025→20%, 2026→22%. " +
        "Если данных нет — так и скажи. Давай конкретные следующие шаги.",
      messages: aiMessages,
      tools,
      runTool,
      maxTokens: 2000,
    });

    return ok({ reply: text, html: renderMarkdown(text) });
  });
}
