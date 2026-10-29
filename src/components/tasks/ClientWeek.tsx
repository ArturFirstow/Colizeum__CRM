import Link from "next/link";
import type { ReactNode } from "react";
import { requireSession } from "@/lib/auth";
import { isLeadership } from "@/lib/scope";
import { EmptyState } from "@/components/ui/primitives";
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

// ─────────────────────────────────────────────────────────────────────────────
// Вид «По клиентам» в разделе «Задачи»: недельная сверка с менеджером.
//
// Порядок экрана повторяет порядок РАЗГОВОРА, а не структуру базы:
//   неделя → что в красной зоне → общая заметка → по каждому клиенту
//   «сделано / делаем / дальше».
// Это те самые три вопроса, которые задают на еженедельной сверке по списку
// клиентов, — раньше их задавали по Google-документу.
//
// ⚠️ Второй системы задач тут нет: это те же `Task`, что на доске. Отметили
// «Готова» здесь — сразу видно в «Сегодня» и на доске, просрочка считается
// один раз.
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

/** Одна из трёх частей внутри клиента. */
function Bucket({
  title,
  hint,
  tone,
  tasks,
  divider,
}: {
  title: string;
  hint: string;
  tone: string;
  tasks: WorksheetTask[];
  /** Вертикальная черта слева — только на широком экране, где колонки рядом. */
  divider?: boolean;
}) {
  return (
    // min-w-0 обязателен: иначе длинное название задачи распирает колонку,
    // а с ней всю страницу (та же причина, что в карточках клиентов).
    <div className={`min-w-0 lg:px-5 ${divider ? "lg:border-l lg:border-ink-800" : "lg:pl-0"}`}>
      <h4 className={`mb-2 text-xs font-semibold uppercase tracking-wide ${tone}`}>
        {title} · {tasks.length}
      </h4>
      {tasks.length === 0 ? (
        // Коротко: эта подпись повторяется у каждого клиента по три раза,
        // и целое предложение превращало экран в стену одинакового текста.
        <p className="text-xs text-ink-500" title={hint}>
          —
        </p>
      ) : (
        <div className="space-y-2">
          {tasks.map((t) => (
            <WorksheetTaskRow key={t.id} task={toRow(t)} />
          ))}
        </div>
      )}
    </div>
  );
}

export async function ClientWeek({
  week,
  owner,
  viewSwitch,
}: {
  week?: string;
  owner?: string;
  viewSwitch: ReactNode;
}) {
  const session = await requireSession();
  const weekStart = parseWeek(week);

  // Руководитель отдела смотрит чужие недели только на чтение — он не ставит
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
    ...new Set(
      sheet.clients.flatMap((c) =>
        [...c.done, ...c.now, ...c.next].map((t) => t.groupLabel?.trim() ?? ""),
      ),
    ),
  ].filter(Boolean);

  const wk = weekKey(weekStart);
  const ownerParam = isLeadership(session) && owner ? `&owner=${owner}` : "";
  const link = (w: string) => `/tasks?view=clients&week=${w}${ownerParam}`;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-ink-700 bg-ink-800/60 text-xl">
            ✓
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-ink-50">Задачи</h1>
            <p className="mt-0.5 text-sm text-ink-300">
              {formatDate(sheet.weekStart)} — {formatDate(sheet.weekEnd)} · {sheet.ownerName}
              {sheet.pair.length ? ` и ${sheet.pair.map((p) => p.name).join(", ")}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {viewSwitch}
          {owners.length > 0 && (
            <form className="flex items-center gap-2">
              <input type="hidden" name="view" value="clients" />
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
          <Link href={link(shift(weekStart, -7))} className="btn btn-ghost btn-sm">
            ← неделя
          </Link>
          <Link href={link(weekKey(new Date()))} className="btn btn-ghost btn-sm">
            Текущая
          </Link>
          <Link href={link(shift(weekStart, 7))} className="btn btn-ghost btn-sm">
            неделя →
          </Link>
        </div>
      </div>

      {readOnly && (
        <div className="card mb-5 border-l-4 border-l-brand p-4 text-sm text-ink-300">
          Вы смотрите чужую неделю — только чтение. Задачи ставит руководитель проекта, отмечает —
          его менеджер.
        </div>
      )}

      {sheet.pair.length === 0 && !readOnly && (
        <div className="card mb-5 border-l-4 border-l-amber-400/60 p-4 text-sm text-ink-300">
          <b className="text-ink-100">Проектный менеджер не закреплён.</b> Вид работает и так —
          как личный план по клиентам. Чтобы делить работу с менеджером, админ указывает его
          руководителя проекта на странице{" "}
          <Link href="/team" className="text-brand hover:underline">
            «Команда»
          </Link>
          .
        </div>
      )}

      {/* Сводка недели: считается, а не переписывается руками.
          ⚠️ Прежний третий блок «Сроки недели» убран — он перечислял ровно те
          же задачи, что теперь стоят у клиентов в колонке «Делаем». */}
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
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
                <li className="text-xs text-ink-500">и ещё {sheet.done.length - 8}</li>
              )}
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
          <p className="whitespace-pre-wrap text-sm text-ink-300">{sheet.generalNote ?? "—"}</p>
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
          hint="Разбор строится по карточкам клиентов руководителя проекта."
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

              <div className={c.note ? "mb-4" : "mb-3"}>
                {readOnly ? (
                  c.note && <p className="whitespace-pre-wrap text-sm text-ink-300">{c.note}</p>
                ) : (
                  <WorksheetNote
                    weekStart={wk}
                    advertiserId={c.advertiserId}
                    text={c.note}
                    compactWhenEmpty
                    placeholder="Где мы сейчас по клиенту: что согласовано, чего ждём, на что смотреть"
                  />
                )}
              </div>

              {c.done.length + c.now.length + c.next.length === 0 ? (
                <p className="text-sm text-ink-500">Задач нет.</p>
              ) : (
                /* Три вопроса сверки — три колонки. На телефоне встают
                   друг под друга в том же порядке. */
                <div className="grid gap-5 lg:grid-cols-3 lg:gap-0">
                  <Bucket
                    title="Сделано за неделю"
                    hint="За эту неделю ничего не закрыто."
                    tone="text-emerald-300"
                    tasks={c.done}
                  />
                  <Bucket
                    title="Делаем сейчас"
                    hint="Ничего в работе."
                    tone="text-ink-200"
                    tasks={c.now}
                    divider
                  />
                  <Bucket
                    title="Дальше по сроку"
                    hint="Сроков позже этой недели нет."
                    tone="text-ink-400"
                    tasks={c.next}
                    divider
                  />
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
