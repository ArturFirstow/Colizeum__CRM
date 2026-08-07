import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok, fail } from "@/lib/api";
import { canSeeOwned } from "@/lib/scope";
import { aiComplete, aiConfigured, AI_NO_KEY_MESSAGE, aiErrorMessage } from "@/lib/ai";
import { renderMarkdown } from "@/lib/markdown";
import { formatMoney } from "@/lib/format";
import { z } from "zod";

const schema = z.object({
  dealId: z.string().min(1),
  changes: z.string().trim().min(1, "Опишите, что меняем (сроки, даты, бюджет)"),
});

// «Драфт ДС по шаблону»: ИИ формирует черновик дополнительного соглашения
// с учётом сделки, реквизитов клиента и правил документооборота из базы знаний.
export async function POST(req: NextRequest) {
  return withSession(async (session) => {
    if (!aiConfigured()) return fail("no_api_key", AI_NO_KEY_MESSAGE, 400);
    const { dealId, changes } = schema.parse(await req.json());

    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: { advertiser: true, documents: true },
    });
    if (!deal) return fail("not_found", "Сделка не найдена", 404);
    if (!canSeeOwned(session, deal.advertiser.ownerId)) return fail("forbidden", "Нет доступа", 403);

    // Правила документооборота из базы знаний (шаблоны договоров/ДС).
    const kb = await prisma.knowledgeArticle.findMany({
      where: {
        OR: [
          { category: { contains: "Документооборот" } },
          { title: { contains: "договор" } },
          { title: { contains: "ДС" } },
        ],
      },
      take: 6,
    });

    const a = deal.advertiser;
    const ctx: string[] = [
      "## Сделка",
      `Название: ${deal.title}`,
      `Клиент: ${a.nameRu}${a.legalEntity ? ` / ${a.legalEntity}` : ""}${a.inn ? `, ИНН ${a.inn}` : ""}${a.kpp ? `, КПП ${a.kpp}` : ""}`,
      a.signatory ? `Подписант: ${a.signatory}` : "",
      deal.contractNumber ? `Договор №: ${deal.contractNumber}` : "",
      deal.contractTotal || deal.amount ? `Сумма договора: ${formatMoney(deal.contractTotal || deal.amount)}${deal.vatIncluded ? " (с НДС)" : ""}` : "",
      deal.periodText ? `Срок: ${deal.periodText}` : "",
      deal.paymentTerms ? `Оплата: ${deal.paymentTerms}` : "",
      deal.documents.length ? `Документы: ${deal.documents.map((d) => `${d.type} «${d.title}»`).join("; ")}` : "",
      "",
      "## Что нужно изменить (по словам менеджера)",
      changes,
      "",
      "## Правила документооборота (из базы знаний)",
      ...kb.map((k) => `### ${k.title}\n${k.bodyMarkdown}`),
    ].filter(Boolean);

    try {
      const markdown = await aiComplete({
      maxTokens: 3500,
      system:
        "Ты — юрист-ассистент Colizeum Agency. Составь ЧЕРНОВИК дополнительного соглашения (ДС) " +
        "к договору НА РУССКОМ в Markdown, по правилам документооборота из контекста. " +
        "Структура: шапка (ДС №__ к договору …, дата, город), преамбула (стороны, основания — Устав/МЧД), " +
        "пункты изменений (чётко: что было → что становится, по срокам/датам/бюджету из запроса), " +
        "пункт про остальные условия без изменений, реквизиты и подписи сторон. " +
        "Где данных нет — ставь плейсхолдер в квадратных скобках (напр. [дата], [номер ДС]). " +
        "НДС по дате документа: 2025 → 20%, 2026 → 22%. Не выдумывай реквизиты, которых нет в контексте. " +
        "В начале добавь строку «⚠️ Черновик — проверить юристу перед отправкой».",
      user: ctx.join("\n"),
    });

      return ok({ markdown, html: renderMarkdown(markdown) });
    } catch (e) {
      return fail("ai_failed", aiErrorMessage(e), 502);
    }
  });
}
