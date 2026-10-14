import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { parseSentAt, parseWebhookLead, type WebhookLead } from "@/lib/leads-parse";
import { logTransfer } from "@/lib/services/transfers";
import { notifyNewLead } from "@/lib/services/notify";

// ─────────────────────────────────────────────────────────────────────────────
// Приём заявок с сайта НАПРЯМУЮ, без Google-таблицы посередине.
//
// Как было: форма на colizeum-agency.ru писала в Google-таблицу, а сервис раз
// в три минуты читал её CSV-экспортом. Значит, три места, где может оборваться
// цепочка (доступ к таблице, формат колонок, частота чтения), и задержка.
//
// Как стало: Тильда сама стучится к нам сразу после отправки формы, заявка
// появляется в разделе «Входящие с сайта» в ту же секунду.
//
// ⚠️ Запрос приходит СНАРУЖИ, без сессии сотрудника. Отсюда три правила:
//   1. Пускаем только со служебным ключом (`LEADS_WEBHOOK_SECRET`), сверка —
//      побайтово за постоянное время, чтобы ключ нельзя было подобрать по
//      скорости ответа.
//   2. Тело ограничено по размеру и разбирается руками: у Тильды нет схемы,
//      поля на сайте меняют без нас.
//   3. Любая принятая заявка — это персональные данные человека, поэтому
//      факт приёма пишется в журнал передач (категориями, без значений).
// ─────────────────────────────────────────────────────────────────────────────

/** Больше этого тело запроса не читаем: форма сайта столько не присылает. */
export const WEBHOOK_BODY_LIMIT = 64 * 1024;

/** Окно, в котором две одинаковые заявки считаем одной и той же. */
const DOUBLE_WINDOW_MS = 15 * 60 * 1000;

export function webhookSecret(): string {
  return (process.env.LEADS_WEBHOOK_SECRET ?? "").trim();
}

export function webhookConfigured(): boolean {
  return webhookSecret().length >= 16;
}

/**
 * Сверка ключа. Сравниваем хэши одинаковой длины: иначе `timingSafeEqual`
 * падает на строках разной длины, а сама длина подсказывала бы подбирающему.
 */
export function keyMatches(given: string | null | undefined): boolean {
  const real = webhookSecret();
  if (!real) return false;
  const a = createHash("sha256").update(String(given ?? "")).digest();
  const b = createHash("sha256").update(real).digest();
  return timingSafeEqual(a, b);
}

export type AcceptResult =
  | { outcome: "test" }
  | { outcome: "empty" }
  | { outcome: "created"; id: string }
  | { outcome: "duplicate"; id: string };

/**
 * Принимает разобранное тело запроса и заводит заявку.
 * Ничего не бросает наружу по бизнес-поводам — вебхук должен отвечать 200,
 * иначе Тильда начнёт считать интеграцию сломанной.
 */
export async function acceptWebhookLead(
  payload: Record<string, unknown>,
  opts: { referer?: string } = {},
): Promise<AcceptResult> {
  const lead = parseWebhookLead(payload, { fallbackReferer: opts.referer });

  // Тильда при подключении присылает проверочный запрос — заявку по нему не
  // заводим, но отвечаем успехом, иначе вебхук не сохранится.
  if (lead.isTest && !hasContent(lead)) return { outcome: "test" };
  if (!hasContent(lead)) return { outcome: "empty" };

  const externalId = lead.externalId || fingerprint(lead);
  const now = new Date();
  const data = {
    name: lead.name || null,
    company: lead.company || null,
    contact: lead.contact || null,
    message: lead.message || null,
    referer: lead.referer || null,
    formId: lead.formId || null,
    sentAt: parseSentAt(lead.sentAt) ?? now,
    syncedAt: now,
  };

  // Та же отправка пришла второй раз — не плодим карточки: двойная заявка
  // означает два звонка одному человеку.
  const same = await prisma.lead.findUnique({ where: { externalId }, select: { id: true } });
  if (same) {
    // Тот же номер отправки — это буквально тот же запрос, данные совпадают.
    await prisma.lead.update({ where: { id: same.id }, data });
    logAccepted(lead, "повтор");
    return { outcome: "duplicate", id: same.id };
  }

  // Похожая заявка от того же человека минуту назад (например, та же форма
  // пришла и вебхуком, и из таблицы). Поля НЕ перезаписываем: человек мог
  // отправить форму дважды с разным текстом, и затереть первый текст — значит
  // потерять то, что он написал. Новый текст дописываем снизу.
  const double = await findRecentDouble(lead, now);
  if (double) {
    const addition =
      lead.message && lead.message !== double.message
        ? [double.message, `— повторная отправка: ${lead.message}`].filter(Boolean).join("\n")
        : double.message;
    await prisma.lead.update({
      where: { id: double.id },
      data: {
        message: addition,
        name: double.name ?? data.name,
        company: double.company ?? data.company,
        formId: double.formId ?? data.formId,
        referer: double.referer ?? data.referer,
        syncedAt: now,
      },
    });
    logAccepted(lead, "повтор");
    return { outcome: "duplicate", id: double.id };
  }

  const created = await prisma.lead.create({ data: { externalId, ...data } });
  logAccepted(lead, "новая заявка");

  // Уведомление шлём после записи: если Telegram не настроен или молчит,
  // заявка всё равно уже в сервисе.
  await notifyNewLead({ company: lead.company, hasMessage: Boolean(lead.message) }).catch((e) =>
    console.error("[leads-webhook] уведомление не ушло:", e),
  );

  return { outcome: "created", id: created.id };
}

function hasContent(lead: WebhookLead): boolean {
  return Boolean(lead.name || lead.company || lead.contact || lead.message);
}

/** Ключ от дублей, когда Тильда не прислала номер отправки. */
function fingerprint(lead: WebhookLead): string {
  const basis = [lead.name, lead.company, lead.contact, lead.message].join("|");
  return `site:${createHash("sha256").update(basis).digest("hex").slice(0, 32)}`;
}

/**
 * Та же заявка, пришедшая другим путём. Нужна на время, пока рядом с вебхуком
 * ещё работает чтение Google-таблицы: иначе одно обращение легло бы в сервис
 * дважды — с номером отправки от вебхука и с `requestid` из таблицы.
 */
async function findRecentDouble(lead: WebhookLead, now: Date) {
  if (!lead.contact) return null;
  return prisma.lead.findFirst({
    where: {
      contact: lead.contact,
      createdAt: { gt: new Date(now.getTime() - DOUBLE_WINDOW_MS) },
    },
    select: { id: true, name: true, company: true, message: true, formId: true, referer: true },
    orderBy: { createdAt: "desc" },
  });
}

/** В журнал — категории данных, а не их значения (требование 4.12). */
function logAccepted(lead: WebhookLead, purposeSuffix: string): void {
  logTransfer("site-webhook", {
    purpose: `Приём обращения с формы сайта (${purposeSuffix})`,
    dataKinds: [
      lead.name ? "имя" : "",
      lead.company ? "компания" : "",
      lead.contact ? "контакт" : "",
      lead.message ? "текст обращения" : "",
    ].filter(Boolean),
  });
}
