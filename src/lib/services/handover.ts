// ─────────────────────────────────────────────────────────────────────────────
// Передача дел: саммари по клиенту для замещающего.
//
// Главная ценность — не сам перенос владельца, а текст «что тут происходит».
// Собираем его из данных сервиса (стадии, суммы, документы, сроки, блокеры),
// а ИИ, если подключён, пересказывает по-человечески. Без ИИ саммари всё равно
// формируется — просто списком фактов.
// ─────────────────────────────────────────────────────────────────────────────

import "server-only";
import { prisma } from "@/lib/prisma";
import { aiComplete, aiConfigured } from "@/lib/ai";
import { formatMoney } from "@/lib/format";

function d(date: Date | null | undefined): string {
  return date ? date.toLocaleDateString("ru-RU") : "—";
}

/** Факты по клиенту — то, из чего собирается саммари. */
export async function collectClientFacts(advertiserId: string): Promise<string> {
  const a = await prisma.advertiser.findUnique({
    where: { id: advertiserId },
    include: {
      contacts: true,
      deals: {
        include: {
          invoices: { include: { payments: true } },
          documents: true,
          tasks: { where: { status: { not: "Готово" } } },
          plannedPayments: { orderBy: { periodMonth: "asc" } },
          ordMarkings: true,
        },
      },
    },
  });
  if (!a) return "";

  const lines: string[] = [`КЛИЕНТ: ${a.nameRu}${a.legalEntity ? ` (${a.legalEntity})` : ""}`];
  if (a.inn) lines.push(`ИНН: ${a.inn}`);

  const primary = a.contacts.find((c) => c.isPrimary) ?? a.contacts[0];
  if (primary) {
    lines.push(
      `Контакт: ${primary.fio}${primary.role ? `, ${primary.role}` : ""}` +
        `${primary.telegram ? `, ${primary.telegram}` : ""}${primary.phone ? `, ${primary.phone}` : ""}`,
    );
  }
  if (a.goals) lines.push(`Цели: ${a.goals}`);
  if (a.notes) lines.push(`Заметки: ${a.notes}`);

  for (const deal of a.deals) {
    const invoiced = deal.invoices.reduce((s, i) => s + (i.amount ?? 0), 0);
    const paid = deal.invoices.reduce(
      (s, i) => s + i.payments.reduce((p, x) => p + (x.amount ?? 0), 0),
      0,
    );
    const scheduled = deal.plannedPayments.reduce((s, p) => s + p.amount, 0);

    lines.push("");
    lines.push(`СДЕЛКА: ${deal.title}`);
    lines.push(`Стадия: ${deal.stage}${deal.urgency ? `, срочность ${deal.urgency}` : ""}`);
    if (deal.contractTotal ?? deal.amount) {
      lines.push(`Сумма по договору: ${formatMoney(deal.contractTotal ?? deal.amount)}`);
    }
    if (deal.contractNumber) lines.push(`Договор № ${deal.contractNumber} от ${d(deal.contractDate)}`);
    if (deal.periodText) lines.push(`Срок: ${deal.periodText}`);
    if (deal.launchDate) lines.push(`Запуск: ${d(deal.launchDate)}`);
    if (invoiced > 0) lines.push(`Выставлено ${formatMoney(invoiced)}, оплачено ${formatMoney(paid)}`);
    if (scheduled > 0) {
      const next = deal.plannedPayments.find((p) => p.status !== "Оплачено");
      lines.push(
        `Плановые платежи: всего ${formatMoney(scheduled)}` +
          (next ? `, ближайший ${next.periodMonth} на ${formatMoney(next.amount)}` : ""),
      );
    }
    if (deal.blockerActive) lines.push(`ВНИМАНИЕ, БЛОКЕР: ${deal.blocker ?? "причина не указана"}`);
    if (deal.situational) lines.push(`Ситуативное: ${deal.situational}`);
    if (deal.nextStep) {
      lines.push(`Следующий шаг: ${deal.nextStep}${deal.nextStepDate ? ` до ${d(deal.nextStepDate)}` : ""}`);
    }
    if (deal.documents.length > 0) {
      lines.push(`Документы: ${deal.documents.map((x) => `${x.type} «${x.title}»`).join("; ")}`);
    }
    if (deal.ordMarkings.length > 0) {
      lines.push(
        `ОРД: ${deal.ordMarkings.map((o) => `${o.role}${o.erid ? ` ERID ${o.erid}` : ""}`).join("; ")}`,
      );
    }
    if (deal.tasks.length > 0) {
      lines.push(
        `Открытые задачи: ${deal.tasks
          .map((t) => `${t.title}${t.dueDate ? ` (до ${d(t.dueDate)})` : ""}`)
          .join("; ")}`,
      );
    }
  }

  if (a.deals.length === 0) lines.push("Активных сделок нет.");
  return lines.join("\n");
}

/**
 * Саммари для замещающего. С ИИ — связный пересказ, без ИИ — те же факты
 * списком: передача не должна зависеть от того, оплачен ли ключ провайдера.
 */
export async function buildHandoverSummary(advertiserIds: string[]): Promise<string> {
  const blocks: string[] = [];
  for (const id of advertiserIds) {
    const facts = await collectClientFacts(id);
    if (facts) blocks.push(facts);
  }
  if (blocks.length === 0) return "Нечего передавать: у выбранных клиентов нет данных.";

  const facts = blocks.join("\n\n———\n\n");
  if (!aiConfigured()) return facts;

  try {
    const text = await aiComplete({
      system: [
        "Ты передаёшь дела коллеге, который уходит в отпуск замещать другого менеджера.",
        "По каждому клиенту напиши короткую сводку по-русски, простым языком, в таком порядке:",
        "1) где сейчас находится работа (стадия, что уже подписано и оплачено);",
        "2) что горит и требует действий в ближайшие дни, с датами;",
        "3) на что обратить внимание — блокеры, особенности клиента, договорённости.",
        "Без воды и вступлений. Заголовок каждого клиента — его название.",
        "Пиши только то, что есть в данных. Ничего не выдумывай и не додумывай суммы и даты.",
      ].join("\n"),
      user: facts.slice(0, 30_000),
      maxTokens: 1600,
    });
    // Пустой или подозрительно короткий ответ — отдаём факты, они полезнее.
    return text.trim().length > 40 ? text.trim() : facts;
  } catch {
    return facts;
  }
}
