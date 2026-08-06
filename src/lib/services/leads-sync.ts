import "server-only";
import { prisma } from "@/lib/prisma";
import { parseLeadsCsv, parseSentAt } from "@/lib/leads-parse";

// ─────────────────────────────────────────────────────────────────────────────
// Заявки с сайта colizeum-agency.ru.
//
// Форма на сайте складывает заявки в Google-таблицу. Читаем её CSV-экспортом:
// ключей и настройки Google API не нужно, достаточно доступа «по ссылке —
// Читатель». Из таблицы берём только исходные поля; статус/ответственный/
// комментарий ставятся в CRM и синхронизацией не перетираются.
// ─────────────────────────────────────────────────────────────────────────────

const SHEET_ID = process.env.LEADS_SHEET_ID ?? "1ZKMx1VmTIvY-AyZPMuMLlgeyvLWNQvpCyywaInRbu3o";
const SHEET_GID = process.env.LEADS_SHEET_GID ?? "0";

/** Через сколько считаем данные устаревшими и тянем таблицу заново. */
export const LEADS_STALE_MS = 3 * 60 * 1000;

export function leadsSheetUrl(): string {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;
}

export function leadsSheetHumanUrl(): string {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?gid=${SHEET_GID}`;
}

export type LeadsSyncResult = { added: number; updated: number; total: number };

/** Тянет таблицу и обновляет заявки в БД. Бросает понятную ошибку при проблемах доступа. */
export async function syncLeads(): Promise<LeadsSyncResult> {
  let csv: string;
  try {
    const res = await fetch(leadsSheetUrl(), { cache: "no-store", redirect: "follow" });
    if (!res.ok) {
      throw new Error(
        `Google-таблица недоступна (код ${res.status}). Откройте доступ по ссылке: «Настройки доступа» → «Все, у кого есть ссылка» → «Читатель».`,
      );
    }
    csv = await res.text();
  } catch (e) {
    if (e instanceof Error && e.message.includes("Google-таблица")) throw e;
    throw new Error(
      "Не удалось связаться с Google-таблицей — проверьте интернет на этом компьютере. " +
        (e instanceof Error ? e.message : ""),
    );
  }

  // Закрытая таблица отдаёт html-страницу входа вместо CSV.
  if (csv.trimStart().startsWith("<")) {
    throw new Error(
      "Google отдаёт страницу входа вместо таблицы: доступ закрыт. Откройте таблицу → «Настройки доступа» → «Все, у кого есть ссылка» → «Читатель».",
    );
  }

  const raw = parseLeadsCsv(csv);
  if (raw.length === 0) {
    throw new Error(
      "В таблице не нашлось строк с заявками. Проверьте, что колонки называются name / name_company / contact / Textarea / sent / requestid.",
    );
  }

  const now = new Date();
  let added = 0;
  let updated = 0;

  for (const r of raw) {
    const data = {
      name: r.name || null,
      company: r.company || null,
      contact: r.contact || null,
      message: r.message || null,
      referer: r.referer || null,
      formId: r.formId || null,
      sentAt: parseSentAt(r.sentAt),
      syncedAt: now,
    };
    const existing = await prisma.lead.findUnique({
      where: { externalId: r.externalId },
      select: { id: true },
    });
    if (existing) {
      await prisma.lead.update({ where: { externalId: r.externalId }, data });
      updated++;
    } else {
      await prisma.lead.create({ data: { externalId: r.externalId, ...data } });
      added++;
    }
  }

  return { added, updated, total: raw.length };
}

/** Синхронизация «по необходимости»: молча пропускаем, если данные свежие. */
export async function syncLeadsIfStale(): Promise<{ error?: string }> {
  const last = await prisma.lead.aggregate({ _max: { syncedAt: true } });
  const lastAt = last._max.syncedAt?.getTime() ?? 0;
  if (Date.now() - lastAt < LEADS_STALE_MS) return {};
  try {
    await syncLeads();
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Не удалось обновить заявки" };
  }
}
