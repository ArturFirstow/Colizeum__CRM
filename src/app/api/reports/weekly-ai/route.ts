import { prisma } from "@/lib/prisma";
import { withSession, ok, fail } from "@/lib/api";
import { ownScope, advertiserScope } from "@/lib/scope";
import { renderMarkdown } from "@/lib/markdown";
import { aiComplete, aiConfigured, aiErrorMessage, AI_NO_KEY_MESSAGE } from "@/lib/ai";

// Недельное ИИ-саммари (ТЗ р.2, п.4): агент собирает контекст прогресса
// по клиентам за 7 дней (статусы дня, журнал, состояние сделок) и выдаёт
// лаконичное саммари по каждому партнёру, с кем велась работа.
export async function POST() {
  return withSession(async (session) => {
    // Раздел долго оставался на прямом ключе Anthropic и ломался при смене
    // провайдера. Теперь идёт через общий шов ai.ts, как остальные ИИ-функции.
    if (!aiConfigured()) return fail("ai_not_configured", AI_NO_KEY_MESSAGE, 400);

    const weekAgo = new Date(Date.now() - 7 * 86400000);

    const [statuses, journal, deals] = await Promise.all([
      prisma.dailyStatus.findMany({
        where: { date: { gte: weekAgo }, advertiser: ownScope(session) },
        include: { advertiser: { select: { nameRu: true } }, deal: { select: { title: true, stage: true } } },
        orderBy: { date: "asc" },
      }),
      prisma.journalEntry.findMany({
        where: { date: { gte: weekAgo }, ...ownScope(session) },
        orderBy: { date: "asc" },
      }),
      prisma.deal.findMany({
        where: { ...advertiserScope(session), advertiser: { ...ownScope(session), archived: false } },
        select: {
          title: true, stage: true, urgency: true, amount: true,
          blocker: true, blockerActive: true, situational: true, nextStep: true, nextStepDate: true,
          advertiser: { select: { nameRu: true } },
        },
      }),
    ]);

    if (statuses.length === 0 && journal.length === 0) {
      return fail("no_data", "За последние 7 дней нет ни статусов дня, ни записей журнала — саммари не из чего собрать.", 400);
    }

    const context = [
      "## Статусы дня за неделю",
      ...statuses.map(
        (s) =>
          `- ${s.date.toISOString().slice(0, 10)} · ${s.advertiser.nameRu}${s.deal ? ` (${s.deal.title}, стадия: ${s.deal.stage})` : ""}: ${s.text}`,
      ),
      "",
      "## Записи журнала за неделю",
      ...journal.map((j) => `- ${j.date.toISOString().slice(0, 10)} [${j.source}]: ${j.rawText}`),
      "",
      "## Текущее состояние сделок",
      ...deals.map(
        (d) =>
          `- ${d.advertiser.nameRu} — «${d.title}»: стадия ${d.stage}, срочность ${d.urgency ?? "—"}${d.amount ? `, сумма ${d.amount} ₽` : ""}${d.blockerActive ? `; блокер: ${d.blocker ?? ""}` : ""}${d.situational ? `; ситуативное: ${d.situational}` : ""}${d.nextStep ? `; следующий шаг: ${d.nextStep}${d.nextStepDate ? ` (до ${d.nextStepDate.toISOString().slice(0, 10)})` : ""}` : ""}`,
      ),
    ].join("\n");

    try {
      const markdown = await aiComplete({
        system:
          "Ты — ассистент менеджера рекламных проектов Colizeum Agency. " +
          "По данным за неделю составь лаконичное недельное саммари НА РУССКОМ в Markdown. " +
          "Структура: по одному разделу `## <Название партнёра>` для КАЖДОГО клиента, по которому была работа за неделю. " +
          "В каждом разделе 2–4 коротких пункта: что продвинулось, что застряло и почему, что дальше (с дедлайном, если есть). " +
          "В конце раздел `## Итоги недели` — 3 пункта: главное достижение, главный риск, фокус следующей недели. " +
          "Пиши только по фактам из данных, ничего не выдумывай. Если по клиенту данных мало — так и скажи одной строкой.",
        user: context,
        maxTokens: 4000,
      });
      return ok({ markdown, html: renderMarkdown(markdown) });
    } catch (e) {
      return fail("ai_error", aiErrorMessage(e), 502);
    }
  });
}
