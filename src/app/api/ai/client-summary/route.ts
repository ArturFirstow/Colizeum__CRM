import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok, fail } from "@/lib/api";
import { canSeeOwned } from "@/lib/scope";
import { aiComplete, aiConfigured, AI_NO_KEY_MESSAGE } from "@/lib/ai";
import { renderMarkdown } from "@/lib/markdown";
import { formatMoney } from "@/lib/format";
import { z } from "zod";

const schema = z.object({ advertiserId: z.string().min(1) });

// «Саммари клиента за месяц»: ИИ собирает контекст по клиенту (сделки, статусы дня,
// задачи, платежи за ~30 дней) и выдаёт короткое резюме + как ускорить оплату.
export async function POST(req: NextRequest) {
  return withSession(async (session) => {
    if (!aiConfigured()) return fail("no_api_key", AI_NO_KEY_MESSAGE, 400);
    const { advertiserId } = schema.parse(await req.json());

    const adv = await prisma.advertiser.findUnique({
      where: { id: advertiserId },
      include: {
        deals: { include: { plannedPayments: true }, orderBy: { updatedAt: "desc" } },
        dailyStatuses: { where: { date: { gte: new Date(Date.now() - 35 * 86400000) } }, orderBy: { date: "asc" } },
        tasks: { where: { status: { not: "Готова" } }, orderBy: { dueDate: "asc" } },
      },
    });
    if (!adv) return fail("not_found", "Клиент не найден", 404);
    if (!canSeeOwned(session, adv.ownerId)) return fail("forbidden", "Нет доступа к клиенту", 403);

    const ctx: string[] = [`# Клиент: ${adv.nameRu}${adv.legalEntity ? ` (${adv.legalEntity})` : ""}`];
    if (adv.goals) ctx.push(`Цель: ${adv.goals}`);
    if (adv.notes) ctx.push(`Заметки: ${adv.notes}`);

    ctx.push("\n## Сделки");
    for (const d of adv.deals) {
      ctx.push(
        `- «${d.title}»: стадия ${d.stage}${d.urgency ? `, срочность ${d.urgency}` : ""}` +
          `${d.contractTotal || d.amount ? `, сумма ${formatMoney(d.contractTotal || d.amount)}` : ""}` +
          `${d.blocker ? `; блокер: ${d.blocker}` : ""}` +
          `${d.nextStep ? `; следующий шаг: ${d.nextStep}` : ""}`,
      );
      for (const p of d.plannedPayments) {
        ctx.push(`  · платёж ${p.periodMonth}: ${formatMoney(p.amount)} — ${p.status}`);
      }
    }

    ctx.push("\n## Статусы дня за последний месяц");
    if (adv.dailyStatuses.length === 0) ctx.push("- (нет записей)");
    for (const s of adv.dailyStatuses) ctx.push(`- ${s.date.toISOString().slice(0, 10)}: ${s.text}`);

    ctx.push("\n## Открытые задачи");
    if (adv.tasks.length === 0) ctx.push("- (нет)");
    for (const t of adv.tasks) ctx.push(`- ${t.title}${t.dueDate ? ` (до ${t.dueDate.toISOString().slice(0, 10)})` : ""}${t.notes ? ` — ${t.notes}` : ""}`);

    const markdown = await aiComplete({
      maxTokens: 2000,
      system:
        "Ты — ассистент менеджера рекламных проектов Colizeum Agency. " +
        "По данным о клиенте составь короткое деловое саммари НА РУССКОМ в Markdown. " +
        "Структура: `## Где сейчас` (2–4 пункта: стадия, деньги, что застряло), " +
        "`## Риски` (что тормозит оплату/подписание), " +
        "`## Как ускорить` (2–3 конкретных следующих шага, чтобы быстрее выйти на сделку и оплату). " +
        "Пиши только по фактам из данных, ничего не выдумывай. Кратко, по делу.",
      user: ctx.join("\n"),
    });

    return ok({ markdown, html: renderMarkdown(markdown) });
  });
}
