import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { LEGAL_DOCS } from "@/lib/legal";

// ─────────────────────────────────────────────────────────────────────────────
// Принятие правовых документов (требования 4.2 и 5.8).
//
// Раньше документы просто лежали ссылкой в подвале, а «акцептом» считался
// сам факт входа. Доказать принятие было нечем, и галочки, которую человек
// ставит сам, не существовало — а требование просит ровно её.
//
// Версия документа — отпечаток его текста. Поправили текст политики → версия
// сменилась → сервис снова попросит принять. Иначе легко оказаться в
// положении, когда все «приняли», но приняли прошлогоднюю редакцию.
// ─────────────────────────────────────────────────────────────────────────────

/** Документы, которые работник принимает при первом входе. */
export const CONSENT_SLUGS = ["polzovatelskoe", "politika", "soglasie"] as const;

/** Короткий отпечаток текста — он же версия. */
export function docVersion(body: string): string {
  return createHash("sha256").update(body).digest("hex").slice(0, 12);
}

export type PendingDoc = { slug: string; title: string; version: string; updated: string };

/** Какие документы этому человеку ещё предстоит принять. */
export async function pendingConsents(userId: string): Promise<PendingDoc[]> {
  const docs = LEGAL_DOCS.filter((d) => (CONSENT_SLUGS as readonly string[]).includes(d.slug));
  const accepted = await prisma.consentRecord.findMany({
    where: { userId, docSlug: { in: docs.map((d) => d.slug) } },
    select: { docSlug: true, docVersion: true },
  });
  const seen = new Set(accepted.map((a) => `${a.docSlug}:${a.docVersion}`));

  return docs
    .map((d) => ({ slug: d.slug, title: d.title, version: docVersion(d.body), updated: d.updated }))
    .filter((d) => !seen.has(`${d.slug}:${d.version}`));
}

/** Записывает принятие. Повторное принятие той же версии не дублируется. */
export async function recordConsents(userId: string, slugs: string[], ip: string | null) {
  const docs = LEGAL_DOCS.filter((d) => slugs.includes(d.slug));
  for (const d of docs) {
    const version = docVersion(d.body);
    const exists = await prisma.consentRecord.findFirst({
      where: { userId, docSlug: d.slug, docVersion: version },
      select: { id: true },
    });
    if (exists) continue;
    await prisma.consentRecord.create({
      data: { userId, docSlug: d.slug, docVersion: version, ip },
    });
  }
}
