// ─────────────────────────────────────────────────────────────────────────────
// Уведомления в Telegram.
//
// Зачем: вопрос руководителю, поручение сотруднику и поднятый блокер иначе видны
// только тому, кто зашёл в сервис и посмотрел. Бот доставляет их сразу.
//
// Настройка — docs/TELEGRAM.md. Не настроено — функции молча ничего не делают,
// сервис работает как раньше.
// ─────────────────────────────────────────────────────────────────────────────

import "server-only";
import { prisma } from "@/lib/prisma";

function botToken(): string | undefined {
  return process.env.TELEGRAM_BOT_TOKEN || undefined;
}

/** Настроен ли бот (для подсказок в интерфейсе). */
export function telegramConfigured(): boolean {
  return Boolean(botToken());
}

/**
 * Отправка одному адресату. Ошибку не бросает и не логирует громко: уведомление
 * — вещь вспомогательная, из-за него не должно падать сохранение записи.
 */
async function send(chatId: string, text: string): Promise<void> {
  const token = botToken();
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    // Молчим намеренно: недоступный Telegram не должен ломать работу сервиса.
  }
}

/** Адрес сервиса для ссылок в сообщениях. */
function appUrl(path: string): string {
  const base = (process.env.APP_URL || "").replace(/\/+$/, "");
  return base ? `${base}${path}` : "";
}

function withLink(text: string, path: string, label: string): string {
  const url = appUrl(path);
  return url ? `${text}\n\n<a href="${url}">${label}</a>` : text;
}

/** Уведомить конкретного сотрудника. */
export async function notifyUser(userId: string, text: string): Promise<void> {
  if (!telegramConfigured()) return;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { telegramChatId: true },
  });
  if (user?.telegramChatId) await send(user.telegramChatId, text);
}

/** Уведомить всех руководителей (Director и Owner). */
export async function notifyLeadership(text: string): Promise<void> {
  if (!telegramConfigured()) return;
  const leaders = await prisma.user.findMany({
    where: { role: { in: ["Director", "Owner"] }, telegramChatId: { not: null } },
    select: { telegramChatId: true },
  });
  await Promise.all(leaders.map((l) => send(l.telegramChatId!, text)));
}

// ── Готовые сообщения под события сервиса ────────────────────────────────────

export async function notifyDecisionCreated(opts: {
  title: string;
  kind: string;
  authorName: string;
  clientName?: string | null;
  details?: string | null;
}): Promise<void> {
  const lines = [
    `❓ <b>Вопрос руководителю</b>`,
    ``,
    `<b>${opts.title}</b>`,
    `Тип: ${opts.kind}`,
    `От: ${opts.authorName}`,
    opts.clientName ? `Клиент: ${opts.clientName}` : "",
    opts.details ? `\n${opts.details.slice(0, 500)}` : "",
  ].filter(Boolean);
  await notifyLeadership(withLink(lines.join("\n"), "/dashboard", "Открыть «Сегодня»"));
}

export async function notifyDecisionResolved(opts: {
  requesterId: string;
  title: string;
  status: string;
  answer?: string | null;
}): Promise<void> {
  const lines = [
    opts.status === "Решён" ? `✅ <b>Ваш вопрос решён</b>` : `↩️ <b>Ваш вопрос отклонён</b>`,
    ``,
    `<b>${opts.title}</b>`,
    opts.answer ? `\nОтвет: ${opts.answer.slice(0, 500)}` : "",
  ].filter(Boolean);
  await notifyUser(opts.requesterId, withLink(lines.join("\n"), "/dashboard", "Открыть «Сегодня»"));
}

export async function notifyTaskAssigned(opts: {
  assigneeId: string;
  title: string;
  fromName: string;
  clientName?: string | null;
  dueDate?: Date | null;
}): Promise<void> {
  const due = opts.dueDate
    ? `\nСрок: ${opts.dueDate.toLocaleDateString("ru-RU")}`
    : "";
  const lines = [
    `🎯 <b>Поручение от руководителя</b>`,
    ``,
    `<b>${opts.title}</b>`,
    `Поручил: ${opts.fromName}`,
    opts.clientName ? `Клиент: ${opts.clientName}` : "",
    due,
  ].filter(Boolean);
  await notifyUser(opts.assigneeId, withLink(lines.join("\n"), "/tasks", "Открыть задачи"));
}

export async function notifyBlockerRaised(opts: {
  dealId: string;
  dealTitle: string;
  clientName: string;
  reason?: string | null;
  byName: string;
}): Promise<void> {
  const lines = [
    `⛔ <b>Блокер по сделке</b>`,
    ``,
    `<b>${opts.clientName}</b> — ${opts.dealTitle}`,
    opts.reason ? `Причина: ${opts.reason.slice(0, 400)}` : "Причина не указана",
    `Отметил: ${opts.byName}`,
  ];
  await notifyLeadership(withLink(lines.join("\n"), `/deals/${opts.dealId}`, "Открыть сделку"));
}
