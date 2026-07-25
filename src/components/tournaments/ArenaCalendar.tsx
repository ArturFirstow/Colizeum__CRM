"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, FormError } from "@/components/ui/Modal";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { apiFetch } from "@/lib/client";
import {
  ARENA_BOOKING_STATUSES,
  ARENA_TIME_SLOTS,
  ARENA_ZONE_PRESETS,
} from "@/lib/enums";

type Booking = {
  id: string;
  zone: string;
  timeSlot: string | null;
  status: string;
  clientLabel: string | null;
  notes: string | null;
  startDate: string;
  endDate: string;
  tournament: { id: string; title: string } | null;
  contractor: { id: string; name: string } | null;
  tournamentId: string | null;
  contractorId: string | null;
};
type Opt = { id: string; title?: string; name?: string };

const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const DAY_W = 30;
const LABEL_W = 150;

const STATUS_BAR: Record<string, string> = {
  Подтверждена: "bg-emerald-500/80 text-ink-950",
  Ожидание: "bg-amber-500/80 text-ink-950",
  Проведено: "bg-ink-600/70 text-ink-200",
  Отменена: "bg-red-500/70 text-ink-50 line-through",
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function isoDay(year: number, month: number, day: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

export function ArenaCalendar({
  bookings,
  tournaments,
  contractors,
}: {
  bookings: Booking[];
  tournaments: Opt[];
  contractors: Opt[];
}) {
  const router = useRouter();
  const now = new Date();
  const [ym, setYm] = useState(now.getFullYear() * 12 + now.getMonth());
  const [addOpen, setAddOpen] = useState(false);
  const [edit, setEdit] = useState<Booking | null>(null);
  const [dragOverZone, setDragOverZone] = useState<string | null>(null);
  const dragRef = useRef<{ id: string; durDays: number; grabOffset: number } | null>(null);

  const year = Math.floor(ym / 12);
  const month = ym % 12;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthStart = new Date(year, month, 1).getTime();
  const monthEnd = new Date(year, month, daysInMonth, 23, 59, 59).getTime();

  // Брони, попадающие в текущий месяц.
  const monthBookings = useMemo(
    () =>
      bookings.filter((b) => {
        const s = new Date(b.startDate).getTime();
        const e = new Date(b.endDate).getTime();
        return e >= monthStart && s <= monthEnd;
      }),
    [bookings, monthStart, monthEnd],
  );

  // Зоны-дорожки: всегда «Вся арена» + встречающиеся в данных.
  const zones = useMemo(() => {
    const set = new Set<string>(["Вся арена"]);
    for (const b of monthBookings) set.add(b.zone || "Вся арена");
    return [...set];
  }, [monthBookings]);

  const gridCols = `${LABEL_W}px repeat(${daysInMonth}, ${DAY_W}px)`;

  // День недели для подсветки выходных.
  const weekend = (day: number) => {
    const wd = new Date(year, month, day).getDay();
    return wd === 0 || wd === 6;
  };

  function bookingDays(b: Booking) {
    const s = new Date(b.startDate);
    const e = new Date(b.endDate);
    const startDay = s.getTime() < monthStart ? 1 : s.getDate();
    const endDay = e.getTime() > monthEnd ? daysInMonth : e.getDate();
    return { startDay, endDay: Math.max(startDay, endDay) };
  }

  async function handleDrop(e: React.DragEvent<HTMLDivElement>, targetZone: string) {
    e.preventDefault();
    setDragOverZone(null);
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const day = Math.floor((e.clientX - rect.left - LABEL_W) / DAY_W) + 1;
    let newStart = day - drag.grabOffset;
    newStart = Math.max(1, Math.min(newStart, daysInMonth - drag.durDays));
    const newEnd = newStart + drag.durDays;
    await apiFetch(`/api/tournaments/arena/${drag.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        zone: targetZone,
        startDate: isoDay(year, month, newStart),
        endDate: isoDay(year, month, newEnd),
      }),
    });
    router.refresh();
  }

  return (
    <section className="card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button className="btn-icon" onClick={() => setYm((v) => v - 1)} aria-label="Предыдущий месяц">
            ‹
          </button>
          <div className="min-w-[150px] text-center font-display text-lg font-semibold uppercase tracking-wide text-ink-50">
            {MONTHS[month]} {year}
          </div>
          <button className="btn-icon" onClick={() => setYm((v) => v + 1)} aria-label="Следующий месяц">
            ›
          </button>
          <button className="btn btn-ghost btn-sm ml-1" onClick={() => setYm(now.getFullYear() * 12 + now.getMonth())}>
            Сегодня
          </button>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setAddOpen(true)}>
          + Бронь
        </button>
      </div>

      <div className="mb-3 flex flex-wrap gap-3 text-xs text-ink-400">
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-4 rounded-sm bg-emerald-500/80" /> подтверждена</span>
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-4 rounded-sm bg-amber-500/80" /> ожидание</span>
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-4 rounded-sm bg-ink-600/70" /> проведено</span>
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-4 rounded-sm bg-red-500/70" /> отменена</span>
      </div>

      <div className="overflow-x-auto pb-2">
        <div style={{ minWidth: LABEL_W + daysInMonth * DAY_W }}>
          {/* Шапка с числами */}
          <div className="grid" style={{ gridTemplateColumns: gridCols }}>
            <div className="sticky left-0 z-10 bg-ink-850 px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-ink-500">
              Зона
            </div>
            {Array.from({ length: daysInMonth }).map((_, i) => (
              <div
                key={i}
                className={`border-l border-ink-800 py-1.5 text-center text-[11px] font-medium ${weekend(i + 1) ? "bg-ink-900/40 text-ink-500" : "text-ink-400"}`}
              >
                {i + 1}
              </div>
            ))}
          </div>

          {/* Дорожки-зоны */}
          {zones.map((zone, zi) => {
            const rowBookings = monthBookings.filter((b) => (b.zone || "Вся арена") === zone);
            return (
              <div
                key={zone}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragOverZone !== zone) setDragOverZone(zone);
                }}
                onDragLeave={() => setDragOverZone((z) => (z === zone ? null : z))}
                onDrop={(e) => handleDrop(e, zone)}
                className={`grid items-center ${zi % 2 ? "bg-ink-900/30" : ""} ${dragOverZone === zone ? "outline outline-1 outline-brand/40" : ""}`}
                style={{ gridTemplateColumns: gridCols, minHeight: 38 }}
              >
                <div className="sticky left-0 z-10 flex items-center bg-ink-850 px-2 py-1">
                  <span className="truncate text-xs font-medium text-ink-100">{zone}</span>
                </div>
                {Array.from({ length: daysInMonth }).map((_, i) => (
                  <div key={`bg${i}`} style={{ gridColumn: `${2 + i}`, gridRow: 1 }} className={`h-full border-l border-ink-800/60 ${weekend(i + 1) ? "bg-ink-900/20" : ""}`} />
                ))}
                {rowBookings.map((b) => {
                  const { startDay, endDay } = bookingDays(b);
                  const label = b.tournament?.title ?? b.contractor?.name ?? b.clientLabel ?? "—";
                  return (
                    <button
                      key={b.id}
                      draggable
                      onDragStart={(ev) => {
                        const rect = (ev.target as HTMLElement).getBoundingClientRect();
                        dragRef.current = {
                          id: b.id,
                          durDays: endDay - startDay,
                          grabOffset: Math.floor((ev.clientX - rect.left) / DAY_W),
                        };
                        ev.dataTransfer.effectAllowed = "move";
                        ev.dataTransfer.setData("text/plain", b.id);
                      }}
                      onDragEnd={() => setDragOverZone(null)}
                      onClick={() => setEdit(b)}
                      style={{ gridColumn: `${1 + startDay} / ${2 + endDay}`, gridRow: 1 }}
                      title={`${label} · ${b.status}${b.timeSlot ? ` · ${b.timeSlot}` : ""} (тянуть — перенести, клик — правка)`}
                      className={`z-[1] mx-0.5 my-1 flex cursor-grab items-center gap-1 truncate rounded-md px-1.5 py-1 text-[11px] font-semibold ring-1 ring-black/20 transition hover:brightness-110 active:cursor-grabbing ${STATUS_BAR[b.status] ?? "bg-ink-500/70 text-ink-50"}`}
                    >
                      <span className="truncate">{label}</span>
                      {b.timeSlot && b.timeSlot !== "Весь день" && <span className="opacity-70">· {b.timeSlot}</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {monthBookings.length === 0 && (
        <p className="mt-3 text-center text-sm text-ink-500">В этом месяце броней нет. Добавьте — кнопка «+ Бронь».</p>
      )}

      {addOpen && (
        <BookingModal
          tournaments={tournaments}
          contractors={contractors}
          defaultMonth={{ year, month }}
          onClose={() => setAddOpen(false)}
          onSaved={() => router.refresh()}
        />
      )}
      {edit && (
        <BookingModal
          booking={edit}
          tournaments={tournaments}
          contractors={contractors}
          onClose={() => setEdit(null)}
          onSaved={() => router.refresh()}
        />
      )}
    </section>
  );
}

function BookingModal({
  booking,
  tournaments,
  contractors,
  defaultMonth,
  onClose,
  onSaved,
}: {
  booking?: Booking;
  tournaments: Opt[];
  contractors: Opt[];
  defaultMonth?: { year: number; month: number };
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = !!booking;
  const defStart = defaultMonth ? isoDay(defaultMonth.year, defaultMonth.month, 1) : "";
  const [f, setF] = useState({
    tournamentId: booking?.tournamentId ?? "",
    contractorId: booking?.contractorId ?? "",
    clientLabel: booking?.clientLabel ?? "",
    zone: booking?.zone ?? "Вся арена",
    timeSlot: booking?.timeSlot ?? "Весь день",
    status: booking?.status ?? "Ожидание",
    startDate: booking ? booking.startDate.slice(0, 10) : defStart,
    endDate: booking ? booking.endDate.slice(0, 10) : defStart,
    notes: booking?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof f>(k: K, v: string) {
    setF((s) => ({ ...s, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const body = {
        tournamentId: f.tournamentId || undefined,
        contractorId: f.contractorId || undefined,
        clientLabel: f.clientLabel || undefined,
        zone: f.zone || "Вся арена",
        timeSlot: f.timeSlot || undefined,
        status: f.status,
        startDate: f.startDate,
        endDate: f.endDate || f.startDate,
        notes: f.notes || undefined,
      };
      if (editing) {
        await apiFetch(`/api/tournaments/arena/${booking!.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await apiFetch("/api/tournaments/arena", { method: "POST", body: JSON.stringify(body) });
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
    <Modal open onClose={onClose} title={editing ? "Бронь арены" : "Новая бронь"} size="lg">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Турнир</label>
            <select className="input" value={f.tournamentId} onChange={(e) => set("tournamentId", e.target.value)}>
              <option value="">— нет —</option>
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Заказчик</label>
            <select className="input" value={f.contractorId} onChange={(e) => set("contractorId", e.target.value)}>
              <option value="">— нет —</option>
              {contractors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">…или бренд текстом</label>
          <input className="input" value={f.clientLabel} onChange={(e) => set("clientLabel", e.target.value)} placeholder="если нет карточки" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Зона арены</label>
            <input className="input" list="zones" value={f.zone} onChange={(e) => set("zone", e.target.value)} placeholder="Вся арена" />
            <datalist id="zones">
              {ARENA_ZONE_PRESETS.map((z) => (
                <option key={z} value={z} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="label">Тайм-слот</label>
            <select className="input" value={f.timeSlot} onChange={(e) => set("timeSlot", e.target.value)}>
              {ARENA_TIME_SLOTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Начало *</label>
            <input className="input" type="date" value={f.startDate} onChange={(e) => set("startDate", e.target.value)} required />
          </div>
          <div>
            <label className="label">Конец</label>
            <input className="input" type="date" value={f.endDate} onChange={(e) => set("endDate", e.target.value)} />
          </div>
          <div>
            <label className="label">Статус</label>
            <select className="input" value={f.status} onChange={(e) => set("status", e.target.value)}>
              {ARENA_BOOKING_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Заметки</label>
          <input className="input" value={f.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>
        <FormError message={error} />
        <div className="flex items-center justify-between gap-2">
          {editing ? (
            <DeleteButton endpoint={`/api/tournaments/arena/${booking!.id}`} what="бронь" variant="button" />
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "…" : editing ? "Сохранить" : "Забронировать"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
