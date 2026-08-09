import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok } from "@/lib/api";
import { isLeadership } from "@/lib/scope";

// ─────────────────────────────────────────────────────────────────────────────
// События для всплывающих уведомлений на сайте.
//
// Отдельной таблицы намеренно нет: всё, о чём стоит сообщить, уже лежит в
// сделках, задачах и запросах. Считаем «что нового с момента X» на лету —
// это дешевле и не плодит ещё одну сущность, которую надо чистить.
// ─────────────────────────────────────────────────────────────────────────────

export type NotificationItem = {
  id: string;
  kind: "decision" | "answer" | "task" | "blocker";
  title: string;
  body: string;
  href: string;
  at: string;
};

export async function GET(req: NextRequest) {
  return withSession(async (session) => {
    const { searchParams } = new URL(req.url);
    const sinceRaw = searchParams.get("since");
    // Первый заход — берём последний час, чтобы не вываливать всю историю.
    const since = sinceRaw ? new Date(sinceRaw) : new Date(Date.now() - 60 * 60 * 1000);
    if (Number.isNaN(since.getTime())) return ok({ items: [], now: new Date().toISOString() });

    const items: NotificationItem[] = [];
    const leader = isLeadership(session);

    // Руководителю: новые вопросы и поднятые блокеры по отделу.
    if (leader) {
      const decisions = await prisma.decisionRequest.findMany({
        where: { status: "Открыт", createdAt: { gt: since }, requesterId: { not: session.userId } },
        include: { requester: { select: { name: true } }, advertiser: { select: { nameRu: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
      for (const d of decisions) {
        items.push({
          id: `decision:${d.id}`,
          kind: "decision",
          title: "Ждёт вашего решения",
          body: `${d.title} — ${d.requester.name}${d.advertiser ? ` · ${d.advertiser.nameRu}` : ""}`,
          href: "/dashboard",
          at: d.createdAt.toISOString(),
        });
      }

      const blocked = await prisma.deal.findMany({
        where: { blockerActive: true, updatedAt: { gt: since } },
        include: { advertiser: { select: { nameRu: true } } },
        orderBy: { updatedAt: "desc" },
        take: 10,
      });
      for (const d of blocked) {
        items.push({
          id: `blocker:${d.id}:${d.updatedAt.getTime()}`,
          kind: "blocker",
          title: "Блокер по сделке",
          body: `${d.advertiser.nameRu} — ${d.blocker ?? "причина не указана"}`,
          href: `/deals/${d.id}`,
          at: d.updatedAt.toISOString(),
        });
      }
    }

    // Всем: новые поручения от руководителя.
    const tasks = await prisma.task.findMany({
      where: { assigneeId: session.userId, assignedById: { not: null }, createdAt: { gt: since } },
      include: { assignedBy: { select: { name: true } }, advertiser: { select: { nameRu: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    for (const t of tasks) {
      items.push({
        id: `task:${t.id}`,
        kind: "task",
        title: "Поручение руководителя",
        body: `${t.title}${t.advertiser ? ` · ${t.advertiser.nameRu}` : ""}`,
        href: "/tasks",
        at: t.createdAt.toISOString(),
      });
    }

    // Всем: ответ на мой вопрос.
    const answered = await prisma.decisionRequest.findMany({
      where: { requesterId: session.userId, resolvedAt: { gt: since } },
      orderBy: { resolvedAt: "desc" },
      take: 10,
    });
    for (const d of answered) {
      items.push({
        id: `answer:${d.id}`,
        kind: "answer",
        title: d.status === "Решён" ? "Ваш вопрос решён" : "Ваш вопрос отклонён",
        body: d.answer ? `${d.title} — ${d.answer}` : d.title,
        href: "/dashboard",
        at: (d.resolvedAt ?? d.createdAt).toISOString(),
      });
    }

    items.sort((a, b) => b.at.localeCompare(a.at));
    return ok({ items: items.slice(0, 12), now: new Date().toISOString() });
  });
}
