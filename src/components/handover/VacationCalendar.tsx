"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, FormError } from "@/components/ui/Modal";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { apiFetch } from "@/lib/client";
import { ABSENCE_KINDS, type AbsenceKind } from "@/lib/enums";
import { ABSENCE_BAR } from "@/lib/absence";

// ─────────────────────────────────────────────────────────────────────────────
// Календарь отпусков: годовая сетка «кто когда не на месте».
//
// Строка — сотрудник, колонка — неделя года (по 4 на месяц, как в календаре
// размещений, чтобы сетки читались одинаково). Полоса — период отсутствия.
// У полосы можно указать, кто подхватывает дела: без этого календарь просто
// сообщает о проблеме, а с этим — отвечает, к кому идти.
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

const MONTHS = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
const WEEKS_PER_MONTH = 4;
const TOTAL_WEEKS = 12 * WEEKS_PER_MONTH;
const WEEK_W = 20; // px на неделю
const LABEL_W = 170; // px на колонку с именем

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function toDateInput(d: string | Date) {
  const x = new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}
/** «1 сентября — 21 сентября 2026»; год пишем один раз, если он совпадает. */
function humanRange(start: string | Date, end: string | Date): string {
  const a = new Date(start);
  const b = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" };
  const left = a.toLocaleDateString("ru-RU", a.getFullYear() === b.getFullYear() ? opts : { ...opts, year: "numeric" });
  const right = b.toLocaleDateString("ru-RU", { ...opts, year: "numeric" });
  return `${left} — ${right}`;
}

/** Дата → индекс недели в году (0…47). Вне года — отрицательный / ≥48. */
function weekIndex(d: Date, year: number) {
  return (d.getFullYear() - year) * TOTAL_WEEKS + d.getMonth() * WEEKS_PER_MONTH + Math.min(3, Math.floor((d.getDate() - 1) / 7));
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
  const [year, setYear] = useState(new Date().getFullYear());
  const [add, setAdd] = useState<{ userId: string } | null>(null);
  const [edit, setEdit] = useState<Absence | null>(null);

  // Отсутствия текущего года, разложенные по сотрудникам.
  const byPerson = useMemo(() => {
    const map = new Map<string, (Absence & { from: number; to: number })[]>();
    for (const a of absences) {
      const from = weekIndex(new Date(a.startDate), year);
      const to = weekIndex(new Date(a.endDate), year);
      // Отсутствие целиком в другом году — в этой сетке не показываем;
      // задевающее край — обрезаем по границе года.
      if (to < 0 || from >= TOTAL_WEEKS) continue;
      const list = map.get(a.userId) ?? [];
      list.push({ ...a, from: Math.max(0, from), to: Math.min(TOTAL_WEEKS - 1, to) });
      map.set(a.userId, list);
    }
    return map;
  }, [absences, year]);

  const gridCols = `${LABEL_W}px repeat(${TOTAL_WEEKS}, ${WEEK_W}px)`;
  const todayWeek = new Date().getFullYear() === year ? weekIndex(new Date(), year) : -1;

  // Список под сеткой: что ещё не закончилось, ближайшее — сверху.
  const upcoming = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return absences
      .filter((a) => new Date(a.endDate) >= today)
      .sort((x, y) => +new Date(x.startDate) - +new Date(y.startDate))
      .slice(0, 12);
  }, [absences]);

  return (
    <section className="card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink-50">Календарь отпусков</h2>
          <p className="mt-0.5 text-sm text-ink-400">
            Кто когда не на месте и кто подхватывает дела. Нажмите на пустое место в строке, чтобы поставить
            период.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost btn-sm" onClick={() => setYear((y) => y - 1)} title="Предыдущий год">
            ←
          </button>
          <span className="min-w-[3.5rem] text-center font-semibold text-ink-100">{year}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setYear((y) => y + 1)} title="Следующий год">
            →
          </button>
        </div>
      </div>

      {/* Легенда: типы отсутствия различаются цветом, без неё полосы немые. */}
      <div className="mb-4 flex flex-wrap gap-3 text-xs text-ink-400">
        {ABSENCE_KINDS.map((k) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className={`inline-block h-3 w-5 rounded ${ABSENCE_BAR[k]}`} />
            {k}
          </span>
        ))}
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-max">
          {/* Шапка: месяцы */}
          <div className="grid" style={{ gridTemplateColumns: gridCols }}>
            <div />
            {MONTHS.map((m) => (
              <div
                key={m}
                className="border-l border-ink-800 pb-1 text-center text-xs font-semibold text-ink-400"
                style={{ gridColumn: `span ${WEEKS_PER_MONTH}` }}
                title={`${m} ${year}`}
              >
                {m}
              </div>
            ))}
          </div>

          {/* Строки сотрудников */}
          {people.map((p) => {
            const rows = byPerson.get(p.id) ?? [];
            const canEditRow = canPlanForOthers || p.id === meId;
            return (
              <div
                key={p.id}
                className="grid items-center border-t border-ink-800"
                style={{ gridTemplateColumns: gridCols, minHeight: 40 }}
              >
                <div className="truncate py-2 pr-3 text-sm text-ink-200">
                  {p.name}
                  {p.id === meId && <span className="ml-1.5 text-xs text-ink-500">(вы)</span>}
                </div>

                {/* Фон: клетки-недели. Клик по клетке — добавить период.
                    Текущая неделя помечена жёлтой чертой слева, а не заливкой:
                    заливка читалась как ещё одна полоса отсутствия. */}
                {Array.from({ length: TOTAL_WEEKS }).map((_, w) => (
                  <button
                    key={w}
                    disabled={!canEditRow}
                    onClick={() => canEditRow && setAdd({ userId: p.id })}
                    className={`h-8 border-l ${
                      w === todayWeek
                        ? "border-brand/70"
                        : w % WEEKS_PER_MONTH === 0
                          ? "border-ink-800"
                          : "border-ink-800/40"
                    } ${canEditRow ? "hover:bg-ink-800/60" : "cursor-default"}`}
                    style={{ gridRow: 1, gridColumn: w + 2 }}
                    title={
                      w === todayWeek
                        ? "Текущая неделя"
                        : canEditRow
                          ? `Добавить отсутствие: ${p.name}`
                          : p.name
                    }
                  />
                ))}

                {/* Полосы отсутствий поверх клеток. Подпись показываем только
                    там, где она физически влезает: на короткой полосе от имени
                    остаётся огрызок вроде «Ко». Полное описание — в подсказке
                    при наведении и в списке под сеткой. */}
                {rows.map((a) => {
                  const weeks = a.to - a.from + 1;
                  // На полосе в 60 px полное «→ Екатерина Туринова» не живёт —
                  // берём имя без фамилии, остальное дорасскажет подсказка.
                  const label = a.coverUser ? `→ ${a.coverUser.name.split(" ")[0]}` : a.kind;
                  return (
                    <button
                      key={a.id}
                      onClick={() => canEditRow && setEdit(a)}
                      className={`mx-px flex h-6 items-center overflow-hidden whitespace-nowrap rounded px-1 text-[11px] font-medium ${
                        ABSENCE_BAR[a.kind as AbsenceKind] ?? ABSENCE_BAR["Отгул"]
                      } ${canEditRow ? "hover:brightness-110" : "cursor-default"}`}
                      style={{ gridRow: 1, gridColumn: `${a.from + 2} / ${a.to + 3}` }}
                      title={`${p.name} — ${a.kind}: ${toDateInput(a.startDate)} — ${toDateInput(a.endDate)}${
                        a.coverUser ? `\nПодхватывает: ${a.coverUser.name}` : ""
                      }${a.note ? `\n${a.note}` : ""}`}
                    >
                      <span className="truncate">{weeks >= 3 ? label : ""}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {people.length === 0 && <p className="mt-3 text-sm text-ink-500">Сотрудников пока нет.</p>}

      {/* Список словами: на полосе умещается два-три слова, а знать нужно
          точные даты и к кому идти. */}
      {upcoming.length > 0 && (
        <div className="mt-5 border-t border-ink-800 pt-4">
          <h3 className="mb-2 text-sm font-semibold text-ink-200">Ближайшие отсутствия</h3>
          <div className="space-y-1.5">
            {upcoming.map((a) => {
              const person = people.find((p) => p.id === a.userId);
              const canEditRow = canPlanForOthers || a.userId === meId;
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
                  {a.coverUser && <span className="text-ink-300">· подхватывает {a.coverUser.name}</span>}
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
          year={year}
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
          year={year}
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
  existing,
  year,
  onClose,
  onSaved,
}: {
  people: Person[];
  meId: string;
  canPlanForOthers: boolean;
  presetUserId?: string;
  existing?: Absence;
  year: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [userId, setUserId] = useState(existing?.userId ?? presetUserId ?? meId);
  const [kind, setKind] = useState<string>(existing?.kind ?? "Отпуск");
  const [startDate, setStartDate] = useState(
    existing ? toDateInput(existing.startDate) : `${year}-${pad(new Date().getMonth() + 1)}-01`,
  );
  const [endDate, setEndDate] = useState(
    existing ? toDateInput(existing.endDate) : `${year}-${pad(new Date().getMonth() + 1)}-14`,
  );
  const [coverUserId, setCoverUserId] = useState(existing?.coverUser?.id ?? "");
  const [note, setNote] = useState(existing?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
            Появится прямо на полосе в календаре — коллегам будет видно, к кому идти по вашим клиентам.
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
