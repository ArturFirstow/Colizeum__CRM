"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, FormError } from "@/components/ui/Modal";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { apiFetch } from "@/lib/client";
import { ABSENCE_KINDS, type AbsenceKind } from "@/lib/enums";
import { ABSENCE_BAR } from "@/lib/absence";

// ─────────────────────────────────────────────────────────────────────────────
// Календарь отпусков.
//
// Была годовая сетка «сотрудники × 48 недель». Она не работала: недельный
// отпуск занимал одну клетку и терялся, чисел на сетке не было вовсе, а на
// полосе стояло имя замещающего — и читалось так, будто в отпуск уходит он.
//
// Теперь три блока сверху вниз, от «прямо сейчас» к «дальше по плану»:
//   1. «Сегодня не на месте» — ответ на вопрос, который задают чаще всего.
//   2. Месяц по дням: в шапке числа и дни недели, выходные притенены,
//      сегодняшний день отмечен. Недельный отпуск — полоса в семь клеток,
//      мимо такой не пройдёшь.
//   3. Список словами с точными датами.
//
// На полосе пишем ТИП отсутствия («Отпуск»), а замещающего — только словами
// «дела у Кати», чтобы имя нельзя было принять за того, кто уезжает.
// ─────────────────────────────────────────────────────────────────────────────

type Absence = {
  id: string;
  userId: string;
  kind: string;
  startDate: string | Date;
  endDate: string | Date;
  note: string | null;
  coverUser: { id: string; name: string } | null;
};
type Person = { id: string; name: string };

const MONTHS = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];
const WEEKDAYS = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
const DAY_W = 26; // px на день
const LABEL_W = 156; // px на колонку с именем

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function toDateInput(d: string | Date) {
  const x = new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}
function startOfDay(d: string | Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function firstName(full: string) {
  return full.split(" ")[0] ?? full;
}
/** «1 сентября — 21 сентября 2026»; год пишем один раз, если он совпадает. */
function humanRange(start: string | Date, end: string | Date): string {
  const a = new Date(start);
  const b = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" };
  const left = a.toLocaleDateString(
    "ru-RU",
    a.getFullYear() === b.getFullYear() ? opts : { ...opts, year: "numeric" },
  );
  const right = b.toLocaleDateString("ru-RU", { ...opts, year: "numeric" });
  return `${left} — ${right}`;
}
/** «до 14 сентября» — сколько ещё человека не будет. */
function untilText(end: string | Date): string {
  return `до ${new Date(end).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}`;
}
/** Сколько дней в периоде, включая оба края. */
function daysBetween(start: string | Date, end: string | Date): number {
  const ms = +startOfDay(end) - +startOfDay(start);
  return Math.round(ms / 86_400_000) + 1;
}

export function VacationCalendar({
  people,
  absences,
  meId,
  canPlanForOthers,
}: {
  people: Person[];
  absences: Absence[];
  meId: string;
  canPlanForOthers: boolean;
}) {
  const router = useRouter();
  const today = useMemo(() => startOfDay(new Date()), []);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [add, setAdd] = useState<{ userId: string; date?: string } | null>(null);
  const [edit, setEdit] = useState<Absence | null>(null);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthStart = useMemo(() => new Date(year, month, 1), [year, month]);
  const monthEnd = useMemo(() => new Date(year, month, daysInMonth), [year, month, daysInMonth]);
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  // Отсутствия этого месяца, обрезанные по его краям.
  const byPerson = useMemo(() => {
    const map = new Map<string, (Absence & { from: number; to: number; cutLeft: boolean; cutRight: boolean })[]>();
    for (const a of absences) {
      const s = startOfDay(a.startDate);
      const e = startOfDay(a.endDate);
      if (e < monthStart || s > monthEnd) continue;
      const list = map.get(a.userId) ?? [];
      list.push({
        ...a,
        from: s < monthStart ? 1 : s.getDate(),
        to: e > monthEnd ? daysInMonth : e.getDate(),
        cutLeft: s < monthStart,
        cutRight: e > monthEnd,
      });
      map.set(a.userId, list);
    }
    return map;
  }, [absences, monthStart, monthEnd, daysInMonth]);

  // Кого нет прямо сейчас — самый частый вопрос к этому календарю.
  const outNow = useMemo(
    () =>
      absences
        .filter((a) => startOfDay(a.startDate) <= today && startOfDay(a.endDate) >= today)
        .sort((x, y) => +new Date(x.endDate) - +new Date(y.endDate)),
    [absences, today],
  );

  // Список под сеткой: что впереди, ближайшее — сверху.
  const upcoming = useMemo(
    () =>
      absences
        .filter((a) => startOfDay(a.startDate) > today)
        .sort((x, y) => +new Date(x.startDate) - +new Date(y.startDate))
        .slice(0, 10),
    [absences, today],
  );

  const gridCols = `${LABEL_W}px repeat(${daysInMonth}, ${DAY_W}px)`;
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  function shiftMonth(delta: number) {
    setCursor(new Date(year, month + delta, 1));
  }

  return (
    <section className="card p-5">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-ink-50">Кого не будет на месте</h2>
        <p className="mt-0.5 text-sm text-ink-400">
          Отпуска, больничные и командировки всей команды. Нажмите на день в строке сотрудника, чтобы
          отметить период.
        </p>
      </div>

      {/* ── 1. Сегодня ─────────────────────────────────────────────────────── */}
      <div className="mb-5 rounded-xl border border-ink-800 bg-ink-900/40 p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
          Сегодня, {today.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
        </div>
        {outNow.length === 0 ? (
          <p className="text-sm text-ink-300">Все на месте.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {outNow.map((a) => {
              const person = people.find((p) => p.id === a.userId);
              return (
                <div
                  key={a.id}
                  className="flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-900 px-2.5 py-1.5 text-sm"
                >
                  <span
                    className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${
                      ABSENCE_BAR[a.kind as AbsenceKind] ?? ABSENCE_BAR["Отгул"]
                    }`}
                  />
                  <span className="font-medium text-ink-100">{person?.name ?? "—"}</span>
                  <span className="text-ink-400">
                    {a.kind.toLowerCase()}, {untilText(a.endDate)}
                  </span>
                  {a.coverUser && (
                    <span className="rounded bg-ink-800 px-1.5 py-0.5 text-xs text-ink-200">
                      дела у {firstName(a.coverUser.name)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 2. Месяц по дням ───────────────────────────────────────────────── */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost btn-sm" onClick={() => shiftMonth(-1)} title="Предыдущий месяц">
            ←
          </button>
          <span className="min-w-[9.5rem] text-center font-semibold text-ink-100">
            {MONTHS[month]} {year}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => shiftMonth(1)} title="Следующий месяц">
            →
          </button>
          {!isCurrentMonth && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
            >
              Сегодня
            </button>
          )}
        </div>
        {/* Легенда: типы отсутствия различаются цветом, без неё полосы немые. */}
        <div className="flex flex-wrap gap-3 text-xs text-ink-400">
          {ABSENCE_KINDS.map((k) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className={`inline-block h-3 w-5 rounded ${ABSENCE_BAR[k]}`} />
              {k}
            </span>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-max">
          {/* Шапка: числа и дни недели — без них по сетке нельзя было понять,
              когда именно человек выходит. */}
          <div className="grid" style={{ gridTemplateColumns: gridCols }}>
            <div />
            {days.map((d) => {
              const wd = new Date(year, month, d).getDay();
              const weekend = wd === 0 || wd === 6;
              const isToday = isCurrentMonth && d === today.getDate();
              return (
                <div
                  key={d}
                  className={`pb-1 text-center ${weekend ? "text-ink-600" : "text-ink-400"} ${
                    isToday ? "rounded-t bg-brand/15" : ""
                  }`}
                >
                  <div className={`text-[11px] font-semibold ${isToday ? "text-brand" : ""}`}>{d}</div>
                  <div className="text-[9px] uppercase">{WEEKDAYS[wd]}</div>
                </div>
              );
            })}
          </div>

          {/* Строки сотрудников */}
          {people.map((p) => {
            const rows = byPerson.get(p.id) ?? [];
            const canEditRow = canPlanForOthers || p.id === meId;
            return (
              <div
                key={p.id}
                className="grid items-center border-t border-ink-800"
                style={{ gridTemplateColumns: gridCols, minHeight: 38 }}
              >
                <div className="truncate py-2 pr-3 text-sm text-ink-200">
                  {p.name}
                  {p.id === meId && <span className="ml-1.5 text-xs text-ink-500">(вы)</span>}
                </div>

                {/* Фон: клетки-дни. Клик по клетке заводит период с этой даты. */}
                {days.map((d) => {
                  const wd = new Date(year, month, d).getDay();
                  const weekend = wd === 0 || wd === 6;
                  const isToday = isCurrentMonth && d === today.getDate();
                  return (
                    <button
                      key={d}
                      disabled={!canEditRow}
                      onClick={() =>
                        canEditRow &&
                        setAdd({ userId: p.id, date: `${year}-${pad(month + 1)}-${pad(d)}` })
                      }
                      className={`h-8 border-l border-ink-800/50 ${
                        isToday ? "bg-brand/10" : weekend ? "bg-ink-900/50" : ""
                      } ${canEditRow ? "hover:bg-ink-700/60" : "cursor-default"}`}
                      style={{ gridRow: 1, gridColumn: d + 1 }}
                      title={
                        canEditRow
                          ? `${p.name}: отметить отсутствие с ${d} ${MONTHS[month].toLowerCase()}`
                          : p.name
                      }
                    />
                  );
                })}

                {/* Полосы отсутствий поверх клеток. На полосе — тип отсутствия,
                    а не имя замещающего: имя на полосе читалось так, будто
                    уезжает он. Замещающий появляется отдельными словами. */}
                {rows.map((a) => {
                  const width = a.to - a.from + 1;
                  const cover = a.coverUser ? `дела у ${firstName(a.coverUser.name)}` : "";
                  return (
                    <button
                      key={a.id}
                      onClick={() => canEditRow && setEdit(a)}
                      className={`mx-px flex h-6 items-center gap-1.5 overflow-hidden whitespace-nowrap px-1.5 text-[11px] font-medium ${
                        a.cutLeft ? "" : "rounded-l"
                      } ${a.cutRight ? "" : "rounded-r"} ${
                        ABSENCE_BAR[a.kind as AbsenceKind] ?? ABSENCE_BAR["Отгул"]
                      } ${canEditRow ? "hover:brightness-110" : "cursor-default"}`}
                      style={{ gridRow: 1, gridColumn: `${a.from + 1} / ${a.to + 2}` }}
                      title={`${p.name} — ${a.kind.toLowerCase()}: ${humanRange(a.startDate, a.endDate)}${
                        a.coverUser ? `\nДела подхватывает: ${a.coverUser.name}` : ""
                      }${a.note ? `\n${a.note}` : ""}`}
                    >
                      {a.cutLeft && <span className="opacity-70">←</span>}
                      {width >= 3 && <span className="truncate">{a.kind}</span>}
                      {width >= 11 && cover && <span className="truncate opacity-80">· {cover}</span>}
                      {a.cutRight && <span className="ml-auto opacity-70">→</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {people.length === 0 && <p className="mt-3 text-sm text-ink-500">Сотрудников пока нет.</p>}

      {/* ── 3. Список словами ──────────────────────────────────────────────── */}
      {upcoming.length > 0 && (
        <div className="mt-5 border-t border-ink-800 pt-4">
          <h3 className="mb-2 text-sm font-semibold text-ink-200">Впереди</h3>
          <div className="space-y-1.5">
            {upcoming.map((a) => {
              const person = people.find((p) => p.id === a.userId);
              const canEditRow = canPlanForOthers || a.userId === meId;
              const len = daysBetween(a.startDate, a.endDate);
              return (
                <button
                  key={a.id}
                  onClick={() => canEditRow && setEdit(a)}
                  className={`flex w-full flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg px-2 py-1.5 text-left text-sm ${
                    canEditRow ? "hover:bg-ink-800/60" : "cursor-default"
                  }`}
                >
                  <span
                    className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${
                      ABSENCE_BAR[a.kind as AbsenceKind] ?? ABSENCE_BAR["Отгул"]
                    }`}
                  />
                  <span className="font-medium text-ink-100">{person?.name ?? "—"}</span>
                  <span className="text-ink-400">
                    {a.kind.toLowerCase()}: {humanRange(a.startDate, a.endDate)}
                  </span>
                  <span className="text-ink-600">
                    {len} {len === 1 ? "день" : len < 5 ? "дня" : "дней"}
                  </span>
                  {a.coverUser && <span className="text-ink-300">· дела у {a.coverUser.name}</span>}
                  {a.note && <span className="text-ink-500">· {a.note}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-4">
        <button className="btn btn-ghost btn-sm" onClick={() => setAdd({ userId: meId })}>
          + Отметить отсутствие
        </button>
      </div>

      {add && (
        <AbsenceModal
          people={people}
          meId={meId}
          canPlanForOthers={canPlanForOthers}
          presetUserId={add.userId}
          presetDate={add.date}
          fallbackMonth={`${year}-${pad(month + 1)}`}
          onClose={() => setAdd(null)}
          onSaved={() => router.refresh()}
        />
      )}
      {edit && (
        <AbsenceModal
          people={people}
          meId={meId}
          canPlanForOthers={canPlanForOthers}
          existing={edit}
          fallbackMonth={`${year}-${pad(month + 1)}`}
          onClose={() => setEdit(null)}
          onSaved={() => router.refresh()}
        />
      )}
    </section>
  );
}

function AbsenceModal({
  people,
  meId,
  canPlanForOthers,
  presetUserId,
  presetDate,
  existing,
  fallbackMonth,
  onClose,
  onSaved,
}: {
  people: Person[];
  meId: string;
  canPlanForOthers: boolean;
  presetUserId?: string;
  /** День, по которому кликнули в сетке, — с него и начинаем период. */
  presetDate?: string;
  existing?: Absence;
  /** «2026-08» — месяц, открытый в сетке: если кликнули не по клетке. */
  fallbackMonth: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [userId, setUserId] = useState(existing?.userId ?? presetUserId ?? meId);
  const [kind, setKind] = useState<string>(existing?.kind ?? "Отпуск");
  const [startDate, setStartDate] = useState(
    existing ? toDateInput(existing.startDate) : (presetDate ?? `${fallbackMonth}-01`),
  );
  const [endDate, setEndDate] = useState(
    existing ? toDateInput(existing.endDate) : (presetDate ?? `${fallbackMonth}-01`),
  );
  const [coverUserId, setCoverUserId] = useState(existing?.coverUser?.id ?? "");
  const [note, setNote] = useState(existing?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Сколько дней получилось — считаем на глазах, чтобы не ошибиться на день.
  const length = startDate && endDate ? daysBetween(startDate, endDate) : 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const body = JSON.stringify({ userId, kind, startDate, endDate, coverUserId, note });
      if (existing) {
        await apiFetch(`/api/absences/${existing.id}`, { method: "PATCH", body });
      } else {
        await apiFetch("/api/absences", { method: "POST", body });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={existing ? "Отсутствие" : "Отметить отсутствие"}
      subtitle="Календарь виден всей команде"
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Кто</label>
            <select
              className="input"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              disabled={Boolean(existing) || !canPlanForOthers}
            >
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {!canPlanForOthers && !existing && (
              <p className="mt-1 text-xs text-ink-500">Отсутствие другому ставит руководитель.</p>
            )}
          </div>
          <div>
            <label className="label">Что</label>
            <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
              {ABSENCE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Первый день *</label>
            <input
              className="input"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Последний день *</label>
            <input
              className="input"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </div>
        </div>

        {length > 0 && (
          <p className="-mt-2 text-xs text-ink-400">
            Получается {length} {length === 1 ? "день" : length < 5 ? "дня" : "дней"}, включая первый и
            последний.
          </p>
        )}

        <div>
          <label className="label">Кто подхватывает дела</label>
          <select className="input" value={coverUserId} onChange={(e) => setCoverUserId(e.target.value)}>
            <option value="">— не назначен —</option>
            {people
              .filter((p) => p.id !== userId)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
          <p className="mt-1 text-xs text-ink-500">
            В календаре будет написано «дела у Кати» — коллегам видно, к кому идти по вашим клиентам.
          </p>
        </div>

        <div>
          <label className="label">Комментарий</label>
          <input
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="напр. на связи в мессенджере по срочному"
          />
        </div>

        <FormError message={error} />
        <div className="flex items-center justify-between gap-2">
          {existing ? (
            <DeleteButton endpoint={`/api/absences/${existing.id}`} what="отсутствие" variant="text" />
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "…" : "Сохранить"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
