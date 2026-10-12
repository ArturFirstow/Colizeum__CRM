import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { isLeadership } from "@/lib/scope";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { WorksheetNote } from "@/components/worksheet/WorksheetNote";
import { WorksheetTaskRow } from "@/components/worksheet/WorksheetTaskRow";
import { AddWorksheetTask } from "@/components/worksheet/AddWorksheetTask";
import { formatDate } from "@/lib/format";
import {
  buildWorksheet,
  parseWeek,
  weekKey,
  worksheetOwnerId,
  worksheetOwners,
  type WorksheetTask,
} from "@/lib/worksheet";

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// Рабочий лист: дела по клиентам на неделю.
//
// Экран повторяет порядок прежнего задачника в Google-документе, потому что
// этот порядок людям уже привычен: сверху сводка недели (что закрыто, что в
// красной зоне, какие сроки), ниже — разбор по клиентам с абзацем обстановки
// и списком пунктов по блокам.
//
// Главное отличие от документа: сводка и сроки СЧИТАЮТСЯ, а не переписываются
// руками. В документе просрочку замечали глазами при перечитывании.
// ─────────────────────────────────────────────────────────────────────────────

function shift(week: Date, days: number): string {
  const d = new Date(week);
  d.setDate(d.getDate() + days);
  return weekKey(d);
}

function toRow(t: WorksheetTask) {
  return {
    ...t,
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
    comments: t.comments.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })),
  };
}

export default async function WorksheetPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; owner?: string }>;
}) {
  const session = await requireSession();
  const { week, owner } = await searchParams;
  const weekStart = parseWeek(week);

  // Руководитель отдела смотрит чужие листы только на чтение — он не ставит
  // задачи поверх руководителя проекта, иначе размывается ответственность.
  const owners = await worksheetOwners(session);
  const myOwnerId = await worksheetOwnerId(session);
  const viewingOwnerId = isLeadership(session) && owner ? owner : myOwnerId;
  const readOnly = isLeadership(session) && viewingOwnerId !== session.userId;

  const sheet = await buildWorksheet(session, weekStart, viewingOwnerId);

  // Кому можно ставить задачи: сам руководитель проекта и его менеджеры.
  const people = [{ id: sheet.ownerId, name: sheet.ownerName }, ...sheet.pair];
  const managerId = sheet.pair[0]?.id;
  const knownGroups = [
    ...new Set(sheet.clients.flatMap((c) => c.groups.map((g) => g.label))),
  ].filter((g) => g !== "Прочее");

  const wk = weekKey(weekStart);
  const ownerParam = isLeadership(session) && owner ? `&owner=${owner}` : "";

  return (
    <div>
      <PageHeader
        title="Рабочий лист"
        subtitle={`${formatDate(sheet.weekStart)} — ${formatDate(sheet.weekEnd)} · ${sheet.ownerName}${
          sheet.pair.length ? ` и ${sheet.pair.map((p) => p.name).join(", ")}` : ""
        }`}
        icon="▤"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {owners.length > 0 && (
              <form className="flex items-center gap-2">
                <input type="hidden" name="week" value={wk} />
                <select name="owner" defaultValue={viewingOwnerId} className="input h-9 w-auto py-0 text-sm">
                  {owners.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
                <button className="btn btn-ghost btn-sm" type="submit">
                  Открыть
                </button>
              </form>
            )}
            <Link href={`/worksheet?week=${shift(weekStart, -7)}${ownerParam}`} className="btn btn-ghost btn-sm">
              ← неделя
            </Link>
            <Link href={`/worksheet?week=${weekKey(new Date())}${ownerParam}`} className="btn btn-ghost btn-sm">
              Текущая
            </Link>
            <Link href={`/worksheet?week=${shift(weekStart, 7)}${ownerParam}`} className="btn btn-ghost btn-sm">
              неделя →
            </Link>
          </div>
        }
      />

      {readOnly && (
        <div className="card mb-5 border-l-4 border-l-brand p-4 text-sm text-ink-300">
          Вы смотрите чужой лист — только чтение. Задачи ставит руководитель проекта, отмечает —
          его менеджер.
        </div>
      )}

      {sheet.pair.length === 0 && !readOnly && (
        <div className="card mb-5 border-l-4 border-l-amber-400/60 p-4 text-sm text-ink-300">
          <b className="text-ink-100">Проектный менеджер не закреплён.</b> Лист работает и так —
          как личный план по клиентам. Чтобы делить работу с менеджером, админ указывает его
          руководителя проекта на странице{" "}
          <Link href="/team" className="text-brand hover:underline">
            «Команда»
          </Link>
          .
        </div>
      )}

      {/* Сводка недели: три блока, как в прежнем документе, только считаются сами. */}
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <section className="card p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-red-300">
            Красная зона · {sheet.red.length}
          </h2>
          {sheet.red.length === 0 ? (
            <p className="text-sm text-ink-500">Просроченного нет.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {sheet.red.map((t) => (
                <li key={t.id} className="text-ink-200">
                  {t.title}
                  <span className="ml-1 text-xs text-red-300">
                    {t.dueDate ? `до ${formatDate(t.dueDate)}` : "ждёт"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-emerald-300">
            Закрыто за неделю · {sheet.done.length}
          </h2>
          {sheet.done.length === 0 ? (
            <p className="text-sm text-ink-500">Пока ничего не закрыто.</p>
          ) : (
            <ul className="space-y-1.5 text-sm text-ink-400">
              {sheet.done.slice(0, 8).map((t) => (
                <li key={t.id}>{t.title}</li>
              ))}
              {sheet.done.length > 8 && (
                <li className="text-xs text-ink-600">и ещё {sheet.done.length - 8}</li>
              )}
            </ul>
          )}
        </section>

        <section className="card p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-300">
            Сроки недели · {sheet.timeline.length}
          </h2>
          {sheet.timeline.length === 0 ? (
            <p className="text-sm text-ink-500">На этой неделе сроков нет.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {sheet.timeline.map((e, i) => (
                <li key={i} className="flex gap-2">
                  <span className="shrink-0 text-xs text-ink-500">{formatDate(e.date)}</span>
                  <span className="min-w-0">
                    <span className="text-ink-300">{e.clientName}</span>{" "}
                    <span className={e.status === "Готова" ? "text-ink-600 line-through" : "text-ink-200"}>
                      {e.title}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Общая заметка недели — в документе это была шапка «статус и следующие шаги». */}
      <section className="card mb-6 p-4">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-400">
          Общее по неделе
        </h2>
        {readOnly ? (
          <p className="whitespace-pre-wrap text-sm text-ink-300">
            {sheet.generalNote ?? "—"}
          </p>
        ) : (
          <WorksheetNote
            weekStart={wk}
            text={sheet.generalNote}
            placeholder="Что главное на этой неделе, о чём договорились, какие вопросы друг к другу"
          />
        )}
      </section>

      {sheet.clients.length === 0 ? (
        <EmptyState
          icon="▤"
          title="Клиентов нет"
          hint="Лист строится по карточкам клиентов руководителя проекта."
        />
      ) : (
        <div className="space-y-5">
          {sheet.clients.map((c) => (
            <section key={c.advertiserId} className="card p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <Link
                    href={`/advertisers/${c.advertiserId}`}
                    className="text-lg font-bold text-ink-50 hover:text-brand"
                  >
                    {c.name}
                  </Link>
                  {c.overdue > 0 && (
                    <span className="badge bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-500/30">
                      просрочено {c.overdue}
                    </span>
                  )}
                  <span className="text-xs text-ink-500">в работе {c.openCount}</span>
                </div>
                {!readOnly && (
                  <AddWorksheetTask
                    advertiserId={c.advertiserId}
                    advertiserName={c.name}
                    people={people}
                    groups={knownGroups}
                    defaultAssigneeId={managerId}
                  />
                )}
              </div>

              <div className="mb-4">
                {readOnly ? (
                  c.note && <p className="whitespace-pre-wrap text-sm text-ink-300">{c.note}</p>
                ) : (
                  <WorksheetNote
                    weekStart={wk}
                    advertiserId={c.advertiserId}
                    text={c.note}
                    placeholder="Где мы сейчас по клиенту: что согласовано, чего ждём, на что смотреть"
                  />
                )}
              </div>

              {c.groups.length === 0 ? (
                <p className="text-sm text-ink-500">Задач нет.</p>
              ) : (
                <div className="space-y-4">
                  {c.groups.map((g) => (
                    <div key={g.label}>
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
                        {g.label}
                      </h3>
                      <div className="space-y-2">
                        {g.tasks.map((t) => (
                          <WorksheetTaskRow key={t.id} task={toRow(t)} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
