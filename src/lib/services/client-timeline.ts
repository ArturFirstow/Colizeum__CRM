import "server-only";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/format";
import { TIMELINE_ICONS, type TimelineEvent, type TimelineKind } from "@/lib/timeline";

// ─────────────────────────────────────────────────────────────────────────────
// Хронология по клиенту — единая лента всего, что с ним происходило.
//
// Раньше история клиента была раскидана: статусы дня в «Сегодня», встречи в
// «Дневнике», файлы в «Документах», оплаты в «Оплатах». Чтобы вспомнить, на
// чём остановились, приходилось обходить пять разделов. Здесь всё сведено в
// один список по датам — сверху свежее.
//
// Событий с историей изменений в базе нет (стадии сделки не логируются), поэтому
// лента строится из того, что реально записано: даты создания, даты подписания,
// даты оплат и загрузок. Это честная история, а не реконструкция.
// ─────────────────────────────────────────────────────────────────────────────

function push(
  out: TimelineEvent[],
  e: Omit<TimelineEvent, "date" | "icon"> & { date: Date | null | undefined },
) {
  if (!e.date) return;
  const { date, ...rest } = e;
  out.push({
    ...rest,
    date: date.toISOString(),
    icon: TIMELINE_ICONS[e.kind],
    planned: rest.planned ?? date.getTime() > Date.now(),
  });
}

/**
 * Собирает хронологию по клиенту. Область видимости проверяет вызывающая
 * страница — сюда клиент попадает уже проверенным.
 */
export async function buildClientTimeline(advertiserId: string): Promise<TimelineEvent[]> {
  const [deals, statuses, tasks, journal, versions, files, payments, placements, ords] = await Promise.all([
    prisma.deal.findMany({ where: { advertiserId } }),
    prisma.dailyStatus.findMany({ where: { advertiserId }, include: { deal: { select: { title: true } } } }),
    prisma.task.findMany({ where: { advertiserId }, include: { deal: { select: { title: true } } } }),
    prisma.journalEntry.findMany({ where: { advertiserId } }),
    prisma.documentVersion.findMany({
      where: { document: { advertiserId } },
      include: {
        document: { select: { title: true, type: true, deal: { select: { title: true } } } },
        uploadedBy: { select: { name: true } },
      },
    }),
    prisma.fileAsset.findMany({ where: { advertiserId } }),
    prisma.plannedPayment.findMany({ where: { advertiserId }, include: { deal: { select: { title: true } } } }),
    prisma.placement.findMany({ where: { advertiserId }, include: { deal: { select: { title: true } } } }),
    prisma.ordMarking.findMany({
      where: { deal: { advertiserId } },
      include: { deal: { select: { title: true } } },
    }),
  ]);

  const out: TimelineEvent[] = [];

  // ── Сделки: заведение, подписание договора, запуск ──────────────────────────
  for (const d of deals) {
    const href = `/deals/${d.id}`;
    push(out, {
      id: `deal-new-${d.id}`,
      date: d.createdAt,
      kind: "Сделка",
      title: `Заведена сделка «${d.title}»`,
      detail:
        [
          d.dealType,
          d.finalBrand ? `бренд ${d.finalBrand}` : null,
          d.contractTotal || d.amount ? formatMoney(d.contractTotal || d.amount) : null,
        ]
          .filter(Boolean)
          .join(" · ") || null,
      href,
      planned: false,
    });
    push(out, {
      id: `deal-contract-${d.id}`,
      date: d.contractDate,
      kind: "Документ",
      title: `Договор${d.contractNumber ? ` № ${d.contractNumber}` : ""} — дата документа`,
      detail: d.legalResponsible ? `юрист: ${d.legalResponsible}` : null,
      dealTitle: d.title,
      href,
    });
    push(out, {
      id: `deal-launch-${d.id}`,
      date: d.launchDate,
      kind: "Размещение",
      title: "Запуск по сделке",
      detail: d.paymentTerms ? `условия оплаты: ${d.paymentTerms}` : null,
      dealTitle: d.title,
      href,
    });
  }

  // ── Статусы дня ─────────────────────────────────────────────────────────────
  for (const s of statuses) {
    push(out, {
      id: `status-${s.id}`,
      date: s.date,
      kind: "Статус",
      title: s.text,
      dealTitle: s.deal?.title ?? null,
      planned: false,
    });
  }

  // ── Задачи: постановка и срок ───────────────────────────────────────────────
  for (const t of tasks) {
    push(out, {
      id: `task-new-${t.id}`,
      date: t.createdAt,
      kind: "Задача",
      title: `Задача: ${t.title}`,
      detail: [t.kind, t.status, t.notes].filter(Boolean).join(" · "),
      dealTitle: t.deal?.title ?? null,
      href: "/tasks",
      planned: false,
    });
    // Срок показываем только у незакрытых — у готовых он уже неинтересен.
    if (t.status !== "Готова") {
      push(out, {
        id: `task-due-${t.id}`,
        date: t.dueDate,
        kind: "Задача",
        title: `Срок задачи: ${t.title}`,
        detail: `сторона: ${t.side}`,
        dealTitle: t.deal?.title ?? null,
        href: "/tasks",
      });
    }
  }

  // ── Встречи и записи дневника ───────────────────────────────────────────────
  for (const j of journal) {
    const isMeeting = j.source === "Транскрипт" || Boolean(j.meetingWith);
    push(out, {
      id: `journal-${j.id}`,
      date: j.date,
      kind: isMeeting ? "Встреча" : "Статус",
      title: isMeeting
        ? `Встреча${j.meetingWith ? ` — ${j.meetingWith}` : ""}`
        : `Запись дневника (${j.source})`,
      // Расшифровки бывают на несколько страниц — в ленту берём начало.
      detail: j.parsedSummary || trim(j.rawText, 400),
      href: "/journal",
      planned: false,
    });
  }

  // ── Документы: каждая версия — событие ──────────────────────────────────────
  for (const v of versions) {
    push(out, {
      id: `version-${v.id}`,
      date: v.createdAt,
      kind: "Документ",
      title: `${v.document.type}: ${v.document.title} — версия ${v.versionNo}`,
      detail: [v.changeNote, v.uploadedBy?.name ? `загрузил ${v.uploadedBy.name}` : null]
        .filter(Boolean)
        .join(" · "),
      dealTitle: v.document.deal?.title ?? null,
      href: "/documents",
      planned: false,
    });
  }

  // ── Файлы из общего хранилища (счета, медиапланы, макеты) ───────────────────
  for (const f of files) {
    push(out, {
      id: `file-${f.id}`,
      date: f.uploadedAt,
      kind: "Документ",
      title: `${f.kind}: ${f.title}`,
      detail: [f.fileName, f.uploadedByName ? `загрузил ${f.uploadedByName}` : null].filter(Boolean).join(" · "),
      href: `/api/files/${f.id}`,
      planned: false,
    });
  }

  // ── Деньги: план и факт ─────────────────────────────────────────────────────
  for (const p of payments) {
    if (p.paidAt) {
      push(out, {
        id: `pay-fact-${p.id}`,
        date: p.paidAt,
        kind: "Деньги",
        title: `Оплата получена: ${formatMoney(p.amount)}`,
        detail: p.note,
        dealTitle: p.deal?.title ?? null,
        href: "/finances",
        planned: false,
      });
    } else {
      // Плановый платёж привязан к месяцу — ставим его на 1-е число.
      push(out, {
        id: `pay-plan-${p.id}`,
        date: monthStart(p.periodMonth),
        kind: "Деньги",
        title: `${p.status === "Просрочено" ? "Просрочен платёж" : "Платёж по плану"}: ${formatMoney(p.amount)}`,
        detail: p.note,
        dealTitle: p.deal?.title ?? null,
        href: "/finances",
        planned: p.status !== "Просрочено",
      });
    }
  }

  // ── Размещения ──────────────────────────────────────────────────────────────
  for (const pl of placements) {
    push(out, {
      id: `place-${pl.id}`,
      date: pl.startDate,
      kind: "Размещение",
      title: `Размещение: ${pl.slot}`,
      detail: [pl.status, pl.responsible ? `ответственный ${pl.responsible}` : null, pl.notes]
        .filter(Boolean)
        .join(" · "),
      dealTitle: pl.deal?.title ?? null,
      href: "/placements",
    });
  }

  // ── ОРД / маркировка ────────────────────────────────────────────────────────
  for (const o of ords) {
    push(out, {
      id: `ord-${o.id}`,
      date: o.markedAt ?? o.createdAt,
      kind: "ОРД",
      title: o.erid ? `Маркировка ЕРИД ${o.erid}` : "Маркировка ОРД",
      detail: [o.role, o.platform, o.status, o.urgent ? "срочно" : null].filter(Boolean).join(" · "),
      dealTitle: o.deal?.title ?? null,
      href: "/ord",
      planned: false,
    });
    push(out, {
      id: `ord-exp-${o.id}`,
      date: o.expiresAt,
      kind: "ОРД",
      title: `Истекает маркировка${o.erid ? ` ${o.erid}` : ""}`,
      detail: "пост живёт до месяца — снять креатив или продлить",
      dealTitle: o.deal?.title ?? null,
      href: "/ord",
    });
  }

  // Свежее сверху; при равных датах порядок стабильный по id.
  out.sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : a.date < b.date ? 1 : -1));
  return out;
}

function trim(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

/** «2026-08» → 1 августа 2026. Плохой формат — событие просто не покажем. */
function monthStart(periodMonth: string): Date | null {
  const m = periodMonth.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, 1);
}
