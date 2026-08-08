import "server-only";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/format";
import type { SessionPayload } from "@/lib/auth";
import { ownScope, isLeadership, isTournaments } from "@/lib/scope";

// ─────────────────────────────────────────────────────────────────────────────
// «Шапка» разговора с напарником ИИ.
//
// Раньше напарник начинал каждый диалог вслепую: не знал ни имени сотрудника,
// ни его роли, ни даже сегодняшнего числа — а значит не мог посчитать срок для
// задачи «на завтра» и вынужден был тратить шаг на вызов инструментов, чтобы
// узнать простейшие вещи. Теперь всё это подставляется сразу.
//
// Держим блок коротким: это уходит в КАЖДЫЙ запрос, за него платим токенами.
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_RU: Record<string, string> = {
  Owner: "администратор сервиса, работает как специалист",
  Director: "руководитель отдела (видит весь отдел)",
  Manager: "специалист (видит только своих клиентов)",
};

/** Сегодняшняя дата по Москве — сервис живёт в московском времени. */
function todayMoscow(): { iso: string; human: string } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now); // en-CA даёт ГГГГ-ММ-ДД
  const human = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);
  return { iso: parts, human };
}

export async function buildAiContext(session: SessionPayload): Promise<string> {
  const scope = ownScope(session);
  const { iso, human } = todayMoscow();
  const startOfToday = new Date(`${iso}T00:00:00+03:00`);

  const [advertisers, deals, tasks, overdue, inbox, decisions] = await Promise.all([
    prisma.advertiser.findMany({
      where: { ...scope, archived: false },
      select: { nameRu: true },
      orderBy: { nameRu: "asc" },
    }),
    prisma.deal.findMany({
      where: { advertiser: { ...scope, archived: false } },
      select: { title: true, stage: true, amount: true, contractTotal: true, blocker: true },
    }),
    prisma.task.count({ where: { ...scope, status: { not: "Готова" } } }),
    prisma.task.count({ where: { ...scope, status: { not: "Готова" }, dueDate: { lt: startOfToday } } }),
    prisma.fileAsset.count({ where: { ownerType: "inbox", ownerId: session.userId } }),
    prisma.decisionRequest.count({ where: { requesterId: session.userId, status: "Открыт" } }),
  ]);

  const lines: string[] = [];
  lines.push("# С кем ты разговариваешь");
  lines.push(`Сотрудник: ${session.name} (${session.email}).`);
  lines.push(`Роль: ${ROLE_RU[session.role] ?? session.role}.`);
  if (isTournaments(session)) {
    lines.push("Направление: турниры. Рекламные разделы (сделки, ОРД, промокоды) ему не показываются.");
  }
  if (isLeadership(session)) {
    lines.push("Это руководитель: он видит данные всего отдела, а не только свои.");
  }

  lines.push("");
  lines.push("# Сегодня");
  lines.push(`Дата: ${iso} (${human}). Считай сроки от этой даты, не выдумывай другую.`);

  lines.push("");
  lines.push("# Что у него сейчас в работе");
  if (advertisers.length === 0) {
    lines.push("Клиентов нет.");
  } else {
    lines.push(`Клиенты (${advertisers.length}): ${advertisers.map((a) => a.nameRu).join(", ")}.`);
  }

  if (deals.length > 0) {
    const byStage = new Map<string, number>();
    for (const d of deals) byStage.set(d.stage, (byStage.get(d.stage) ?? 0) + 1);
    const stages = [...byStage.entries()].map(([s, n]) => `${s} — ${n}`).join(", ");
    const sum = deals.reduce((acc, d) => acc + (d.contractTotal || d.amount || 0), 0);
    lines.push(`Сделки (${deals.length}) по стадиям: ${stages}.`);
    if (sum > 0) lines.push(`Общая сумма сделок: ${formatMoney(sum)}.`);
    const blockers = deals.filter((d) => d.blocker);
    if (blockers.length > 0) {
      lines.push(`Блокеры: ${blockers.map((d) => `«${d.title}» — ${d.blocker}`).join("; ")}.`);
    }
  }

  lines.push(`Открытых задач: ${tasks}${overdue > 0 ? `, из них просрочено: ${overdue}` : ""}.`);
  if (inbox > 0) {
    lines.push(`Во «входящих» лежит неразобранных файлов: ${inbox} — их можно разложить через route_file.`);
  }
  if (decisions > 0) {
    lines.push(`Отправлено руководителю и ждёт ответа вопросов: ${decisions}.`);
  }

  return lines.join("\n");
}
