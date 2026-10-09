"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, FormError } from "@/components/ui/Modal";
import { apiFetch } from "@/lib/client";
import { PLACEMENT_SLOT_GROUPS, PLACEMENT_STATUSES, DEAL_STAGES } from "@/lib/enums";

// ─────────────────────────────────────────────────────────────────────────────
// Бронь размещения прямо из сделки (просьба коллег И-13).
//
// Раньше бронь заводилась только в «Календаре размещений»: там нужно было
// заново найти клиента в длинном списке и вспомнить, по какой сделке идёт
// размещение. Половина броней оставалась без привязки к сделке — и сверить
// «что продали» с «что встало в сетку» было нечем.
//
// Здесь клиент, сделка и ответственный подставляются сами: заполнить остаётся
// слот и срок. Запись уходит в тот же календарь, это та же сущность.
// ─────────────────────────────────────────────────────────────────────────────

/** Предоплата — четвёртый шаг воронки. Размещение до неё стартовать нельзя
 *  (незыблемое правило домена), поэтому предупреждаем до сохранения. */
function paidAlready(stage: string) {
  const i = (DEAL_STAGES as readonly string[]).indexOf(stage);
  const paid = (DEAL_STAGES as readonly string[]).indexOf("Оплата");
  return i >= paid;
}

export function PlacementButton({
  advertiserId,
  dealId,
  stage,
  responsible,
}: {
  advertiserId: string;
  dealId: string;
  stage: string;
  responsible: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slot, setSlot] = useState<string>(PLACEMENT_SLOT_GROUPS[0].slots[0]);
  const [startDate, setStart] = useState("");
  const [endDate, setEnd] = useState("");
  const [status, setStatus] = useState<string>("Ожидание");
  const [notes, setNotes] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiFetch("/api/placements", {
        method: "POST",
        body: JSON.stringify({
          advertiserId,
          dealId,
          slot,
          responsible: responsible || undefined,
          startDate,
          endDate,
          status,
          notes: notes || undefined,
        }),
      });
      setOpen(false);
      setSlot(PLACEMENT_SLOT_GROUPS[0].slots[0]);
      setStart("");
      setEnd("");
      setStatus("Ожидание");
      setNotes("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
        + Бронь
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Бронь размещения"
        subtitle="Клиент и сделка подставлены из карточки — запись появится в календаре размещений."
      >
        <form onSubmit={submit} className="space-y-4">
          {!paidAlready(stage) && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              Сделка ещё не дошла до оплаты. Забронировать слот можно, но выходить в клубах до
              предоплаты нельзя — оставьте статус «Ожидание».
            </div>
          )}

          <div>
            <label className="label">Слот / формат</label>
            <select className="input" value={slot} onChange={(e) => setSlot(e.target.value)}>
              {PLACEMENT_SLOT_GROUPS.map((g) => (
                <optgroup key={g.title} label={g.title}>
                  {g.slots.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Начало</label>
              <input
                type="date"
                className="input"
                required
                value={startDate}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Конец</label>
              <input
                type="date"
                className="input"
                required
                min={startDate || undefined}
                value={endDate}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="label">Статус</label>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              {PLACEMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Заметка</label>
            <textarea
              className="input min-h-[72px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="что именно встаёт в слот, особые условия"
            />
          </div>

          <FormError message={error} />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Сохраняем…" : "Забронировать"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
