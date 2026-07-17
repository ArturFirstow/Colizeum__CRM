"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, FormError } from "@/components/ui/Modal";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { apiFetch } from "@/lib/client";
import { PLANNED_PAYMENT_STATUSES } from "@/lib/enums";
import { formatMoney, netOfVat } from "@/lib/format";

type PP = {
  id: string;
  advertiserId: string;
  periodMonth: string; // YYYY-MM
  amount: number;
  status: string;
  note: string | null;
};
type Adv = { id: string; nameRu: string };

const MONTHS_RU = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS_RU[(m ?? 1) - 1]} ${String(y).slice(2)}`;
}

function compact(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2).replace(".", ",")} млн`;
  if (amount >= 1_000) return `${Math.round(amount / 1000)} тыс`;
  return String(amount);
}

const STATUS_CELL: Record<string, string> = {
  Оплачено: "bg-emerald-500/20 text-emerald-200 ring-emerald-500/30",
  План: "bg-amber-500/15 text-amber-200 ring-amber-500/30",
  Просрочено: "bg-red-500/20 text-red-200 ring-red-500/30",
};

export function PaymentCalendar({
  advertisers,
  payments,
}: {
  advertisers: Adv[];
  payments: PP[];
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [cell, setCell] = useState<{ advertiserId: string; month: string } | null>(null);

  // Лента на год вперёд: июль 2026 → июль 2027; если платежи выходят
  // за границы — диапазон расширяется автоматически.
  const months = useMemo(() => {
    const BASE_FROM = "2026-07";
    const BASE_TO = "2027-07";
    const set = [...new Set(payments.map((p) => p.periodMonth))].sort();
    const from = set.length > 0 && set[0] < BASE_FROM ? set[0] : BASE_FROM;
    const to = set.length > 0 && set[set.length - 1] > BASE_TO ? set[set.length - 1] : BASE_TO;
    const [minY, minM] = from.split("-").map(Number);
    const [maxY, maxM] = to.split("-").map(Number);
    const out: string[] = [];
    let y = minY;
    let m = minM;
    while (y < maxY || (y === maxY && m <= maxM)) {
      out.push(`${y}-${String(m).padStart(2, "0")}`);
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }
    return out;
  }, [payments]);

  // Строки — рекламодатели, у которых есть платежи.
  const rows = useMemo(() => {
    const ids = new Set(payments.map((p) => p.advertiserId));
    return advertisers.filter((a) => ids.has(a.id));
  }, [advertisers, payments]);

  function cellPayments(advertiserId: string, month: string) {
    return payments.filter((p) => p.advertiserId === advertiserId && p.periodMonth === month);
  }

  const colTotals = months.map((m) => payments.filter((p) => p.periodMonth === m).reduce((s, p) => s + p.amount, 0));
  const grandTotal = payments.reduce((s, p) => s + p.amount, 0);

  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink-50">Календарь платежей</h2>
          <p className="mt-0.5 text-xs text-ink-500">Кто, сколько и когда платит — по месяцам</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setAddOpen(true)}>
          + Плановый платёж
        </button>
      </div>

      {/* Легенда */}
      <div className="mb-3 flex flex-wrap gap-3 text-xs text-ink-400">
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-emerald-500/60" /> оплачено</span>
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-amber-500/60" /> план</span>
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-red-500/60" /> просрочено</span>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink-700 py-10 text-center text-sm text-ink-400">
          Плановых платежей нет. Добавьте первый — «+ Плановый платёж».
        </div>
      ) : (
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <table className="w-full border-separate border-spacing-1 text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-ink-850 px-2 py-1 text-left text-xs font-medium uppercase tracking-wide text-ink-500">
                  Рекламодатель
                </th>
                {months.map((m) => (
                  <th key={m} className="min-w-[74px] px-1 py-1 text-center text-xs font-medium text-ink-400">
                    {monthLabel(m)}
                  </th>
                ))}
                <th className="px-2 py-1 text-right text-xs font-medium uppercase tracking-wide text-ink-500">Итого</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const rowTotal = payments.filter((p) => p.advertiserId === a.id).reduce((s, p) => s + p.amount, 0);
                return (
                  <tr key={a.id}>
                    <td className="sticky left-0 z-10 bg-ink-850 px-2 py-1 text-sm font-medium text-ink-100">
                      {a.nameRu}
                    </td>
                    {months.map((m) => {
                      const cps = cellPayments(a.id, m);
                      if (cps.length === 0)
                        return (
                          <td key={m} className="px-0.5 py-0.5">
                            <button
                              onClick={() => setCell({ advertiserId: a.id, month: m })}
                              className="h-9 w-full rounded-md border border-transparent text-ink-700 transition hover:border-ink-700 hover:text-ink-400"
                            >
                              ·
                            </button>
                          </td>
                        );
                      const total = cps.reduce((s, p) => s + p.amount, 0);
                      const status = cps.some((p) => p.status === "Просрочено")
                        ? "Просрочено"
                        : cps.every((p) => p.status === "Оплачено")
                          ? "Оплачено"
                          : "План";
                      return (
                        <td key={m} className="px-0.5 py-0.5">
                          <button
                            onClick={() => setCell({ advertiserId: a.id, month: m })}
                            className={`h-9 w-full rounded-md px-1 text-xs font-semibold ring-1 ring-inset transition hover:brightness-125 ${STATUS_CELL[status]}`}
                          >
                            {compact(total)}
                          </button>
                        </td>
                      );
                    })}
                    <td className="px-2 py-1 text-right text-sm font-semibold text-ink-100">
                      {formatMoney(rowTotal)}
                    </td>
                  </tr>
                );
              })}
              <tr>
                <td className="sticky left-0 z-10 bg-ink-850 px-2 py-2 text-xs font-medium uppercase tracking-wide text-ink-500">
                  Итого
                </td>
                {colTotals.map((t, i) => (
                  <td key={i} className="px-1 py-2 text-center text-xs text-ink-300">
                    {t > 0 ? compact(t) : ""}
                  </td>
                ))}
                <td className="px-2 py-2 text-right text-sm font-bold text-brand">{formatMoney(grandTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <AddPaymentModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        advertisers={advertisers}
        onSaved={() => router.refresh()}
      />
      <CellModal
        cell={cell}
        advertisers={advertisers}
        payments={cell ? cellPayments(cell.advertiserId, cell.month) : []}
        onClose={() => setCell(null)}
        onChanged={() => router.refresh()}
      />
    </section>
  );
}

function AddPaymentModal({
  open,
  onClose,
  advertisers,
  onSaved,
  presetAdvertiserId,
  presetMonth,
}: {
  open: boolean;
  onClose: () => void;
  advertisers: Adv[];
  onSaved: () => void;
  presetAdvertiserId?: string;
  presetMonth?: string;
}) {
  const [f, setF] = useState({
    advertiserId: presetAdvertiserId ?? "",
    periodMonth: presetMonth ?? "",
    amount: "",
    status: "План",
    note: "",
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
      await apiFetch("/api/planned-payments", {
        method: "POST",
        body: JSON.stringify({
          advertiserId: f.advertiserId,
          periodMonth: f.periodMonth,
          amount: Number(f.amount),
          status: f.status,
          note: f.note || undefined,
        }),
      });
      onSaved();
      onClose();
      setF({ advertiserId: "", periodMonth: "", amount: "", status: "План", note: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Плановый платёж" size="sm">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Рекламодатель *</label>
          <select className="input" value={f.advertiserId} onChange={(e) => set("advertiserId", e.target.value)} required>
            <option value="">— выбрать —</option>
            {advertisers.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nameRu}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Месяц *</label>
            <input className="input" type="month" value={f.periodMonth} onChange={(e) => set("periodMonth", e.target.value)} required />
          </div>
          <div>
            <label className="label">Сумма ₽ *</label>
            <input className="input" type="number" value={f.amount} onChange={(e) => set("amount", e.target.value)} required />
          </div>
        </div>
        <div>
          <label className="label">Статус</label>
          <select className="input" value={f.status} onChange={(e) => set("status", e.target.value)}>
            {PLANNED_PAYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Заметка</label>
          <input className="input" value={f.note} onChange={(e) => set("note", e.target.value)} />
        </div>
        <FormError message={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "…" : "Добавить"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CellModal({
  cell,
  advertisers,
  payments,
  onClose,
  onChanged,
}: {
  cell: { advertiserId: string; month: string } | null;
  advertisers: Adv[];
  payments: PP[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const adv = advertisers.find((a) => a.id === cell?.advertiserId);

  async function patch(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    try {
      await apiFetch(`/api/planned-payments/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      onChanged();
    } finally {
      setBusyId(null);
    }
  }

  // Перенос карточки оплаты на соседний месяц (←/→).
  function shiftMonth(ym: string, delta: number): string {
    const [y, m] = ym.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  if (!cell) return null;

  return (
    <>
      <Modal
        open={!!cell && !addOpen}
        onClose={onClose}
        title={`${adv?.nameRu ?? ""} · ${monthLabel(cell.month)}`}
        size="sm"
      >
        <div className="space-y-3">
          {payments.length === 0 ? (
            <p className="text-sm text-ink-400">Платежей в этом месяце нет.</p>
          ) : (
            payments.map((p) => (
              <div key={p.id} className="rounded-xl border border-ink-800 bg-ink-900/50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {/* Сумма правится сразу, без лишних кликов; Enter или уход из поля — сохранить */}
                  <div>
                    <input
                      className="input h-9 w-36 font-semibold"
                      type="number"
                      defaultValue={p.amount}
                      disabled={busyId === p.id}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (v >= 0 && v !== p.amount) patch(p.id, { amount: v });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      }}
                    />
                    <div className="mt-1 text-xs text-ink-500">без НДС ≈ {formatMoney(netOfVat(p.amount))}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      className="rounded-lg border border-ink-700 bg-ink-900 px-2 py-1 text-xs text-ink-200"
                      value={p.status}
                      disabled={busyId === p.id}
                      onChange={(e) => patch(p.id, { status: e.target.value })}
                    >
                      {PLANNED_PAYMENT_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <DeleteButton endpoint={`/api/planned-payments/${p.id}`} what="платёж" />
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={busyId === p.id}
                    onClick={() => patch(p.id, { periodMonth: shiftMonth(p.periodMonth, -1) })}
                    title="Перенести на месяц раньше"
                  >
                    ← {monthLabel(shiftMonth(p.periodMonth, -1))}
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={busyId === p.id}
                    onClick={() => patch(p.id, { periodMonth: shiftMonth(p.periodMonth, 1) })}
                    title="Перенести на месяц позже"
                  >
                    {monthLabel(shiftMonth(p.periodMonth, 1))} →
                  </button>
                </div>
                {p.note && <div className="mt-1 text-xs text-ink-500">{p.note}</div>}
              </div>
            ))
          )}
          <button className="btn btn-ghost btn-sm w-full" onClick={() => setAddOpen(true)}>
            + Добавить платёж в этот месяц
          </button>
        </div>
      </Modal>
      <AddPaymentModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        advertisers={advertisers}
        onSaved={onChanged}
        presetAdvertiserId={cell.advertiserId}
        presetMonth={cell.month}
      />
    </>
  );
}
