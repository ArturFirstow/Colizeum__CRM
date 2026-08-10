import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok, fail } from "@/lib/api";
import { canSeeOwned } from "@/lib/scope";
import { aiComplete, aiConfigured, AI_NO_KEY_MESSAGE, aiErrorMessage } from "@/lib/ai";
import { renderMarkdown } from "@/lib/markdown";
import { buildClientTimeline } from "@/lib/services/client-timeline";
import { z } from "zod";

const schema = z.object({ advertiserId: z.string().min(1) });

// Событий за год набирается много, а длинный промпт и дорог, и размывает
// внимание модели. Берём последние 150 — этого хватает на историю отношений.
const MAX_EVENTS = 150;

// «Пересказать историю»: ИИ читает хронологию клиента и рассказывает, как мы
// дошли до нынешней точки. Данные — только из ленты, ничего не досочиняем.
export async function POST(req: NextRequest) {
  return withSession(async (session) => {
    if (!aiConfigured()) return fail("no_api_key", AI_NO_KEY_MESSAGE, 400);
    const { advertiserId } = schema.parse(await req.json());

    const adv = await prisma.advertiser.findUnique({
      where: { id: advertiserId },
      select: { id: true, nameRu: true, legalEntity: true, goals: true, ownerId: true },
    });
    if (!adv) return fail("not_found", "Клиент не найден", 404);
    if (!canSeeOwned(session, adv.ownerId)) return fail("forbidden", "Нет доступа к клиенту", 403);

    const events = await buildClientTimeline(adv.id);
    if (events.length === 0) {
      return fail("empty", "По этому клиенту ещё нет событий — пересказывать нечего", 400);
    }

    const ctx: string[] = [`# Клиент: ${adv.nameRu}${adv.legalEntity ? ` (${adv.legalEntity})` : ""}`];
    if (adv.goals) ctx.push(`Цель сотрудничества: ${adv.goals}`);
    ctx.push(`Сегодня: ${new Date().toISOString().slice(0, 10)}`);
    ctx.push("\n## Хронология (сверху — свежее)");

    for (const e of events.slice(0, MAX_EVENTS)) {
      ctx.push(
        `- ${e.date.slice(0, 10)} [${e.kind}]${e.planned ? " (план, ещё не произошло)" : ""} ${e.title}` +
          `${e.dealTitle ? ` — сделка «${e.dealTitle}»` : ""}` +
          `${e.detail ? `; ${e.detail}` : ""}`,
      );
    }
    if (events.length > MAX_EVENTS) {
      ctx.push(`(показаны ${MAX_EVENTS} последних событий из ${events.length})`);
    }

    try {
      const markdown = await aiComplete({
        maxTokens: 2000,
        system:
          "Ты — ассистент менеджера рекламных проектов Colizeum Agency. " +
          "Тебе дана хронология работы с клиентом. Перескажи её НА РУССКОМ в Markdown так, " +
          "чтобы человек, впервые открывший карточку, за минуту понял историю отношений. " +
          "Структура: `## Как всё шло` (связный рассказ по датам, 4–7 предложений), " +
          "`## Где сейчас` (текущая точка: стадия, деньги, что подписано), " +
          "`## Что впереди` (события с пометкой «план» и открытые сроки), " +
          "`## На что обратить внимание` (провисания: долгие паузы, просроченные оплаты, истекающая маркировка). " +
          "Опирайся ТОЛЬКО на переданные события. События с пометкой «план» — это будущее, " +
          "не описывай их как случившееся. Если данных на раздел нет — напиши «нет данных» и не выдумывай.",
        user: ctx.join("\n"),
      });

      return ok({ markdown, html: renderMarkdown(markdown) });
    } catch (e) {
      return fail("ai_failed", aiErrorMessage(e), 502);
    }
  });
}
