"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, FormError } from "@/components/ui/Modal";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { apiFetch } from "@/lib/client";
import { PLACEMENT_STATUSES, PLACEMENT_SLOTS } from "@/lib/enums";

type Placement = {
  id: string;
  slot: string;
  brandLabel: string | null;
  responsible: string | null;
  startDate: string | Date;
  endDate: string | Date;
  status: string;
  advertiser: { id: string; nameRu: string } | null;
};
type Adv = { id: string; nameRu: string };

const MONTHS = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];

const STATUS_BAR: Record<string, string> = {
  Подписан: "bg-emerald-500/80 text-ink-950",
  "На подписании": "bg-amber-500/80 text-ink-950",
  Ожидание: "bg-ink-500/70 text-ink-50",
  Завершено: "bg-ink-600/60 text-ink-300 line-through",
};

const WEEK_W = 26; // px на неделю
const LABEL_W = 210; // px на колонку слота

// Базовая лента: июль 2026 → июль 2027 (расширяется, если брони выходят за границы).
const BASE_FROM = 2026 * 12 + 6; // июль 2026
const BASE_TO = 2027 * 12 + 6; // июль 2027

function ym(d: Date) {
  return d.getFullYear() * 12 + d.getMonth();
}
function weekOfMonth(d: Date) {
  return Math.min(3, Math.floor((d.getDate() - 1) / 7));
}
function pad(n: number) {
  return String(n).padStart(2, "0");
}
function toDateInput(d: string | Date) {
  const x = new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

export function PlacementCalendar({
  placements,
  advertisers,
}: {
  placements: Placement[];
  advertisers: Adv[];
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [edit, setEdit] = useState<Placement | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);
  // Данные текущего перетаскивания (id брони, длительность в неделях, за какую неделю бара «взялись»).
  const dragRef = useRef<{ id: string; durWeeks: number; grabOffset: number } | null>(null);

  // Окно ленты фиксированное слева (июль 2026); вправо расширяется, если брони уходят дальше.
  // Брони, начавшиеся раньше, обрезаются по левому краю; полностью прошедшие — не показываются.
  const model = useMemo(() => {
    let max = BASE_TO;
    for (const p of placements) {
      max = Math.max(max, ym(new Date(p.endDate)));
    }
    return { baseMonth: BASE_FROM, monthCount: max - BASE_FROM + 1 };
  }, [placements]);

  const totalWeeks = model.monthCount * 4;
  const gridCols = `${LABEL_W}px repeat(${totalWeeks}, ${WEEK_W}px)`;

  function weekIndex(d: Date) {
    return (ym(d) - model.baseMonth) * 4 + weekOfMonth(d);
  }

  // Неделя ленты → дата (1/8/15/22 число соответствующего месяца).
  function weekToDateStr(w: number, endOfWeek = false): string {
    const abs = model.baseMonth + Math.floor(w / 4);
    const y = Math.floor(abs / 12);
    const m = abs % 12;
    const day = 1 + (((w % 4) + 4) % 4) * 7 + (endOfWeek ? 6 : 0);
    return `${y}-${pad(m + 1)}-${pad(day)}`;
  }

  // Все слоты из справочника показываются всегда (даже пустые) + нестандартные из данных.
  const slots = useMemo(() => {
    const present = [...new Set(placements.map((p) => p.slot))];
    const extra = present.filter((s) => !(PLACEMENT_SLOTS as readonly string[]).includes(s));
    return [...(PLACEMENT_SLOTS as readonly string[]), ...extra];
  }, [placements]);

  const monthLabel = (i: number) => {
    const m = (model.baseMonth + i) % 12;
    const y = Math.floor((model.baseMonth + i) / 12);
    return `${MONTHS[m]} ${String(y).slice(2)}`;
  };

  // Бросили бар на строку слота: считаем неделю по координате мыши и переносим бронь.
  async function handleDrop(e: React.DragEvent<HTMLDivElement>, targetSlot: string) {
    e.preventDefault();
    setDragOverSlot(null);
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const week = Math.floor((e.clientX - rect.left - LABEL_W) / WEEK_W);
    const newStart = Math.max(0, Math.min(week - drag.grabOffset, totalWeeks - 1 - drag.durWeeks));
    await apiFetch(`/api/placements/${drag.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        slot: targetSlot,
        startDate: weekToDateStr(newStart),
        endDate: weekToDateStr(newStart + drag.durWeeks, true),
      }),
    });
    router.refresh();
  }

  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink-50">Календарь размещений</h2>
          <p className="mt-0.5 text-xs text-ink-500">
            Июль 2026 — июль 2027 · перетаскивайте полосы мышкой по датам и слотам · клик — правка
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setAddOpen(true)}>
          + Бронь
        </button>
      </div>

      <div className="mb-3 flex flex-wrap gap-3 text-xs text-ink-400">
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-4 rounded-sm bg-emerald-500/80" /> подписан</span>
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-4 rounded-sm bg-amber-500/80" /> на подписании</span>
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-4 rounded-sm bg-ink-500/70" /> ожидание</span>
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-4 rounded-sm bg-ink-600/60" /> завершено</span>
      </div>

      <div className="overflow-x-auto pb-2">
        <div style={{ minWidth: LABEL_W + totalWeeks * WEEK_W }}>
          {/* Заголовок месяцев */}
          <div className="grid" style={{ gridTemplateColumns: gridCols }}>
            <div className="sticky left-0 z-10 bg-ink-850 px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-ink-500">
              Слот
            </div>
            {Array.from({ length: model.monthCount }).map((_, i) => (
              <div
                key={i}
                style={{ gridColumn: `${2 + i * 4} / span 4` }}
                className="border-l border-ink-800 px-1 py-1.5 text-center text-xs font-medium text-ink-400"
              >
                {monthLabel(i)}
              </div>
            ))}
          </div>

          {/* Строки слотов — все форматы, даже пустые */}
          {slots.map((slot, si) => {
            const rowPlacements = placements.filter(
              (p) => p.slot === slot && weekIndex(new Date(p.endDate)) >= 0,
            );
            return (
              <div
                key={slot}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragOverSlot !== slot) setDragOverSlot(slot);
                }}
                onDragLeave={() => setDragOverSlot((s) => (s === slot ? null : s))}
                onDrop={(e) => handleDrop(e, slot)}
                className={`grid items-center ${si % 2 ? "bg-ink-900/30" : ""} ${
                  dragOverSlot === slot ? "outline outline-1 outline-brand/40" : ""
                }`}
                style={{ gridTemplateColumns: gridCols, minHeight: 34 }}
              >
                <div className="sticky left-0 z-10 flex flex-col justify-center bg-ink-850 px-2 py-1">
                  <span className="truncate text-xs font-medium text-ink-100">{slot}</span>
                </div>
                {/* фоновые ячейки месяцев (разделители) */}
                {Array.from({ length: model.monthCount }).map((_, i) => (
                  <div key={`bg${i}`} style={{ gridColumn: `${2 + i * 4} / span 4`, gridRow: 1 }} className="h-full border-l border-ink-800/60" />
                ))}
                {/* бары */}
                {rowPlacements.map((p) => {
                  const s = Math.max(0, weekIndex(new Date(p.startDate)));
                  const e2 = Math.min(totalWeeks - 1, weekIndex(new Date(p.endDate)));
                  const brand = p.brandLabel ?? p.advertiser?.nameRu ?? "—";
                  return (
                    <button
                      key={p.id}
                      draggable
                      onDragStart={(ev) => {
                        const rect = (ev.target as HTMLElement).getBoundingClientRect();
                        dragRef.current = {
                          id: p.id,
                          durWeeks: Math.max(0, e2 - s),
                          grabOffset: Math.floor((ev.clientX - rect.left) / WEEK_W),
                        };
                        ev.dataTransfer.effectAllowed = "move";
                        ev.dataTransfer.setData("text/plain", p.id);
                      }}
                      onDragEnd={() => setDragOverSlot(null)}
                      onClick={() => setEdit(p)}
                      style={{ gridColumn: `${2 + s} / ${2 + Math.max(s, e2) + 1}`, gridRow: 1 }}
                      title={`${brand} · ${p.status} (тянуть — перенести, клик — правка)`}
                      className={`z-[1] mx-0.5 my-1 cursor-grab truncate rounded-md px-1.5 py-1 text-[11px] font-semibold ring-1 ring-black/20 transition hover:brightness-110 active:cursor-grabbing ${STATUS_BAR[p.status] ?? "bg-ink-500/70 text-ink-50"}`}
                    >
                      {brand}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <PlacementModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        advertisers={advertisers}
        onSaved={() => router.refresh()}
      />
      {edit && (
        <EditPlacementModal placement={edit} slots={slots} onClose={() => setEdit(null)} onChanged={() => router.refresh()} />
      )}
    </section>
  );
}

function PlacementModal({
  open,
  onClose,
  advertisers,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  advertisers: Adv[];
  onSaved: () => void;
}) {
  const [f, setF] = useState({
    advertiserId: "",
    brandLabel: "",
    slot: PLACEMENT_SLOTS[0] as string,
    responsible: "",
    startDate: "",
    endDate: "",
    status: "Ожидание",
    notes: "",
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
      await apiFetch("/api/placements", {
        method: "POST",
        body: JSON.stringify({
          advertiserId: f.advertiserId || undefined,
          brandLabel: f.brandLabel || undefined,
          slot: f.slot,
          responsible: f.responsible || undefined,
          startDate: f.startDate,
          endDate: f.endDate,
          status: f.status,
          notes: f.notes || undefined,
        }),
      });
      onSaved();
      onClose();
      setF({ advertiserId: "", brandLabel: "", slot: PLACEMENT_SLOTS[0], responsible: "", startDate: "", endDate: "", status: "Ожидание", notes: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Бронь размещения" size="lg">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Слот / формат *</label>
          <input className="input" list="slots" value={f.slot} onChange={(e) => set("slot", e.target.value)} required />
          <datalist id="slots">
            {PLACEMENT_SLOTS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Рекламодатель (из CRM)</label>
            <select className="input" value={f.advertiserId} onChange={(e) => set("advertiserId", e.target.value)}>
              <option value="">— нет —</option>
              {advertisers.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nameRu}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">…или бренд (текстом)</label>
            <input className="input" value={f.brandLabel} onChange={(e) => set("brandLabel", e.target.value)} placeholder="напр. VOLT" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Начало *</label>
            <input className="input" type="date" value={f.startDate} onChange={(e) => set("startDate", e.target.value)} required />
          </div>
          <div>
            <label className="label">Конец *</label>
            <input className="input" type="date" value={f.endDate} onChange={(e) => set("endDate", e.target.value)} required />
          </div>
          <div>
            <label className="label">Статус</label>
            <select className="input" value={f.status} onChange={(e) => set("status", e.target.value)}>
              {PLACEMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Ответственный</label>
          <input className="input" value={f.responsible} onChange={(e) => set("responsible", e.target.value)} />
        </div>
        <FormError message={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "…" : "Забронировать"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditPlacementModal({
  placement,
  slots,
  onClose,
  onChanged,
}: {
  placement: Placement;
  slots: string[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const brand = placement.brandLabel ?? placement.advertiser?.nameRu ?? "—";
  const [f, setF] = useState({
    status: placement.status,
    slot: placement.slot,
    startDate: toDateInput(placement.startDate),
    endDate: toDateInput(placement.endDate),
  });
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof f>(k: K, v: string) {
    setF((s) => ({ ...s, [k]: v }));
  }

  async function save() {
    setSaving(true);
    try {
      await apiFetch(`/api/placements/${placement.id}`, {
        method: "PATCH",
        body: JSON.stringify(f),
      });
      onChanged();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`${brand}`} size="sm">
      <div className="space-y-4">
        <div>
          <label className="label">Слот</label>
          <select className="input" value={f.slot} onChange={(e) => set("slot", e.target.value)}>
            {slots.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Начало</label>
            <input className="input" type="date" value={f.startDate} onChange={(e) => set("startDate", e.target.value)} />
          </div>
          <div>
            <label className="label">Конец</label>
            <input className="input" type="date" value={f.endDate} onChange={(e) => set("endDate", e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Статус</label>
          <select className="input" value={f.status} onChange={(e) => set("status", e.target.value)}>
            {PLACEMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        {placement.responsible && (
          <div className="text-xs text-ink-500">Ответственный: {placement.responsible}</div>
        )}
        <div className="flex items-center justify-between gap-2">
          <DeleteButton endpoint={`/api/placements/${placement.id}`} what={`бронь «${brand}»`} variant="button" />
          <div className="flex gap-2">
            <button className="btn btn-ghost" onClick={onClose}>
              Отмена
            </button>
            <button className="btn btn-primary" disabled={saving} onClick={save}>
              {saving ? "…" : "Сохранить"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
