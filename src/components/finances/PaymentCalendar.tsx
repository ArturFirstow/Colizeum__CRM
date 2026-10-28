"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, FormError } from "@/components/ui/Modal";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { apiFetch } from "@/lib/client";
import { PLANNED_PAYMENT_STATUSES } from "@/lib/enums";
import { formatMoney } from "@/lib/format";
import { toGross } from "@/components/ui/Money";
import { NetAmountInput } from "@/components/ui/NetAmountInput";

type PP = {
  id: string;
  advertiserId: string;
  dealId?: string | null;
  periodMonth: string; // YYYY-MM
  amount: number;
  status: string;
  note: string | null;
};
type Adv = { id: string; nameRu: string };
/** Сделка для расчёта остатка: сумма ЧИСТАЯ, как и суммы плановых платежей. */
type DealOpt = { id: string; title: string; advertiserId: string; budgetNet: number };

/** Месяц «ГГГГ-ММ» ± N месяцев. */
function shiftMonthStr(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

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
  deals = [],
  budgets = {},
}: {
  advertisers: Adv[];
  payments: PP[];
  /** Сделки с чистой суммой договора — для расчёта остатка в окне. */
  deals?: DealOpt[];
  /** Бюджет клиента с НДС — то, что вписано в карточках его сделок. */
  budgets?: Record<string, number>;
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [cell, setCell] = useState<{ advertiserId: string; month: string } | null>(null);
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);
  // Перетаскивание карточки с суммой на другой месяц (в пределах строки клиента).
  const dragRef = useRef<{ advertiserId: string; month: string } | null>(null);

  async function dropTo(advertiserId: string, month: string) {
    const drag = dragRef.current;
    dragRef.current = null;
    setDragOverCell(null);
    if (!drag || drag.advertiserId !== advertiserId || drag.month === month) return;
    const moving = payments.filter(
      (p) => p.advertiserId === drag.advertiserId && p.periodMonth === drag.month,
    );
    await Promise.all(
      moving.map((p) =>
        apiFetch(`/api/planned-payments/${p.id}`, {
          method: "PATCH",
          body: JSON.stringify({ periodMonth: month }),
        }),
      ),
    );
    router.refresh();
  }

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

  // Строки — рекламодатели, у которых есть платежи ИЛИ есть бюджет по сделкам.
  // Клиент с бюджетом, но без разложенных платежей, раньше просто не
  // показывался — и было непонятно, куда делись его деньги.
  const rows = useMemo(() => {
    const ids = new Set(payments.map((p) => p.advertiserId));
    return advertisers.filter((a) => ids.has(a.id) || (budgets[a.id] ?? 0) > 0);
  }, [advertisers, payments, budgets]);

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
          <p className="mt-0.5 text-xs text-ink-500">
            Кто, сколько и когда платит — по месяцам. Это разбивка бюджета по срокам, а не деньги сверх
            него: справа видно, сколько разложено из бюджета по карточкам сделок.
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setAddOpen(true)}>
          + Разложить оплату
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
          Платежей пока нет. Нажмите «Разложить оплату»: сумму можно поставить на один месяц или разбить на несколько.
        </div>
      ) : (
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <table className="w-full border-separate border-spacing-1 text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-20 bg-ink-850 shadow-[10px_0_14px_-10px_rgba(0,0,0,0.95)] px-2 py-1 text-left text-xs font-medium uppercase tracking-wide text-ink-500">
                  Рекламодатель
                </th>
                {months.map((m) => (
                  <th key={m} className="min-w-[74px] px-1 py-1 text-center text-xs font-medium text-ink-400">
                    {monthLabel(m)}
                  </th>
                ))}
                <th className="sticky right-0 z-20 bg-ink-850 shadow-[-10px_0_14px_-10px_rgba(0,0,0,0.95)] px-2 py-1 text-right text-xs font-medium uppercase tracking-wide text-ink-500">
                  Разложено<br />
                  <span className="normal-case text-[10px] text-ink-600">из бюджета</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const rowTotal = payments.filter((p) => p.advertiserId === a.id).reduce((s, p) => s + p.amount, 0);
                return (
                  <tr key={a.id}>
                    <td className="sticky left-0 z-20 bg-ink-850 shadow-[10px_0_14px_-10px_rgba(0,0,0,0.95)] px-2 py-1 text-sm font-medium text-ink-100">
                      {a.nameRu}
                    </td>
                    {months.map((m) => {
                      const cps = cellPayments(a.id, m);
                      const key = `${a.id}|${m}`;
                      const dropProps = {
                        onDragOver: (e: React.DragEvent) => {
                          // принимаем только в пределах строки этого клиента
                          if (dragRef.current?.advertiserId !== a.id) return;
                          e.preventDefault();
                          if (dragOverCell !== key) setDragOverCell(key);
                        },
                        onDragLeave: () => setDragOverCell((c) => (c === key ? null : c)),
                        onDrop: (e: React.DragEvent) => {
                          e.preventDefault();
                          dropTo(a.id, m);
                        },
                      };
                      if (cps.length === 0)
                        return (
                          <td key={m} className="px-0.5 py-0.5" {...dropProps}>
                            <button
                              onClick={() => setCell({ advertiserId: a.id, month: m })}
                              className={`h-9 w-full rounded-md border text-ink-700 transition hover:border-ink-700 hover:text-ink-400 ${
                                dragOverCell === key ? "border-brand/60 bg-brand/10" : "border-transparent"
                              }`}
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
                        <td key={m} className="px-0.5 py-0.5" {...dropProps}>
                          <button
                            draggable
                            onDragStart={(e) => {
                              dragRef.current = { advertiserId: a.id, month: m };
                              e.dataTransfer.effectAllowed = "move";
                              e.dataTransfer.setData("text/plain", key);
                            }}
                            onDragEnd={() => setDragOverCell(null)}
                            onClick={() => setCell({ advertiserId: a.id, month: m })}
                            title="Тянуть — перенести на другой месяц, клик — открыть"
                            className={`h-9 w-full cursor-grab rounded-md px-1 text-xs font-semibold ring-1 ring-inset transition hover:brightness-125 active:cursor-grabbing ${STATUS_CELL[status]} ${
                              dragOverCell === key ? "outline outline-2 outline-brand/60" : ""
                            }`}
                          >
                            {compact(toGross(total))}
                          </button>
                        </td>
                      );
                    })}
                    <td className="sticky right-0 z-20 bg-ink-850 shadow-[-10px_0_14px_-10px_rgba(0,0,0,0.95)] px-2 py-1 text-right text-sm font-semibold text-ink-100">
                      {formatMoney(toGross(rowTotal))}
                      {/* Рядом — бюджет из карточек сделок этого клиента:
                          видно, всё ли разложено, не уходя со страницы. */}
                      <div className="text-[11px] font-normal text-ink-500">
                        из {formatMoney(budgets[a.id] ?? 0)}
                      </div>
                    </td>
                  </tr>
                );
              })}
              <tr>
                <td className="sticky left-0 z-20 bg-ink-850 shadow-[10px_0_14px_-10px_rgba(0,0,0,0.95)] px-2 py-2 text-xs font-medium uppercase tracking-wide text-ink-500">
                  Итого
                </td>
                {colTotals.map((t, i) => (
                  <td key={i} className="px-1 py-2 text-center text-xs text-ink-300">
                    {t > 0 ? compact(toGross(t)) : ""}
                  </td>
                ))}
                <td className="sticky right-0 z-20 bg-ink-850 shadow-[-10px_0_14px_-10px_rgba(0,0,0,0.95)] px-2 py-2 text-right text-sm font-bold text-brand">
                  {formatMoney(toGross(grandTotal))}
                  <div className="text-[11px] font-normal text-ink-500">
                    из {formatMoney(Object.values(budgets).reduce((s, v) => s + v, 0))}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <AddPaymentModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        advertisers={advertisers}
        deals={deals}
        payments={payments}
        onSaved={() => router.refresh()}
      />
      <CellModal
        cell={cell}
        advertisers={advertisers}
        payments={cell ? cellPayments(cell.advertiserId, cell.month) : []}
        deals={deals}
        allPayments={payments}
        onClose={() => setCell(null)}
        onChanged={() => router.refresh()}
      />
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// «Разложить оплату» — окно вместо прежней формы планового платежа.
//
// КАК БЫЛО. Форма спрашивала клиента, месяц и сумму, а галочка «распределить
// равными частями» просила ещё и последний месяц. Сколько по этому клиенту
// уже разложено и сколько осталось до суммы договора, человек считал сам,
// глядя на таблицу выше, — и потому в сервисе регулярно оказывалось разложено
// БОЛЬШЕ, чем сумма договоров (экран честно ругался, но сходилось это руками).
//
// КАК СТАЛО. Окно само знает математику:
//   • выбрал сделку — видно «договор / уже разложено / осталось»;
//   • кнопка «Весь остаток» подставляет сумму, которую осталось покрыть;
//   • два способа: одним платежом или N месяцев равными частями;
//   • до нажатия видно, что получится: сколько платежей, по сколько и с
//     какого по какой месяц.
//
// ⚠️ Суммы плановых платежей лежат в базе ЧИСТЫМИ (без НДС) — как и везде по
// правилу сервиса. Поэтому «осталось» тоже считается в чистых, а на экране
// рядом показывается сумма с НДС: NetAmountInput делает это сам.
// ─────────────────────────────────────────────────────────────────────────────
function AddPaymentModal({
  open,
  onClose,
  advertisers,
  deals,
  payments,
  onSaved,
  presetAdvertiserId,
  presetMonth,
}: {
  open: boolean;
  onClose: () => void;
  advertisers: Adv[];
  /** Сделки с чистой суммой по договору — чтобы считать остаток. */
  deals: DealOpt[];
  /** Уже заведённые плановые платежи — из них считается «разложено». */
  payments: PP[];
  onSaved: () => void;
  presetAdvertiserId?: string;
  presetMonth?: string;
}) {
  const thisMonth = new Date().toISOString().slice(0, 7);
  const [advertiserId, setAdvertiserId] = useState(presetAdvertiserId ?? "");
  const [dealId, setDealId] = useState("");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<"once" | "spread">("once");
  const [month, setMonth] = useState(presetMonth ?? thisMonth);
  const [monthsCount, setMonthsCount] = useState(3);
  const [status, setStatus] = useState("План");
  const [note, setNote] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dealsOfClient = deals.filter((d) => !advertiserId || d.advertiserId === advertiserId);
  const deal = deals.find((d) => d.id === dealId);

  // Сколько уже разложено: по сделке — её платежи, иначе по всему клиенту.
  const already = payments
    .filter((p) => (dealId ? p.dealId === dealId : advertiserId && p.advertiserId === advertiserId))
    .reduce((s, p) => s + p.amount, 0);
  const planned = deal?.budgetNet ?? 0;
  const left = Math.max(0, planned - already);
  const over = Math.max(0, already - planned);

  const parts = useMemo(() => {
    const total = Math.round(Number(amount.replace(/\s/g, "").replace(",", ".")) || 0);
    if (total <= 0 || !month) return [];
    const count = mode === "once" ? 1 : Math.max(1, Math.min(36, monthsCount));
    const base = Math.floor(total / count);
    return Array.from({ length: count }, (_, i) => ({
      month: shiftMonthStr(month, i),
      // Копейки от деления уходят в последний месяц, иначе сумма частей не
      // сойдётся с тем, что ввёл человек.
      amount: i === count - 1 ? total - base * (count - 1) : base,
    }));
  }, [amount, month, mode, monthsCount]);

  function reset() {
    setAdvertiserId(presetAdvertiserId ?? "");
    setDealId("");
    setAmount("");
    setMode("once");
    setMonth(presetMonth ?? thisMonth);
    setMonthsCount(3);
    setStatus("План");
    setNote("");
    setDetailsOpen(false);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (parts.length === 0) {
      setError("Укажите сумму и месяц");
      return;
    }
    setSaving(true);
    try {
      for (let i = 0; i < parts.length; i++) {
        await apiFetch("/api/planned-payments", {
          method: "POST",
          body: JSON.stringify({
            advertiserId,
            dealId: dealId || undefined,
            periodMonth: parts[i].month,
            amount: parts[i].amount,
            status,
            note: note || (parts.length > 1 ? `часть ${i + 1} из ${parts.length}` : undefined),
          }),
        });
      }
      onSaved();
      onClose();
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  const total = parts.reduce((s, p) => s + p.amount, 0);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Разложить оплату"
      subtitle="Сумма, которую платит клиент, — одним платежом или по месяцам"
      size="md"
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Клиент *</label>
            <select
              className="input"
              value={advertiserId}
              onChange={(e) => {
                setAdvertiserId(e.target.value);
                setDealId("");
              }}
              required
            >
              <option value="">— выбрать —</option>
              {advertisers.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nameRu}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Сделка</label>
            <select
              className="input"
              value={dealId}
              onChange={(e) => {
                const id = e.target.value;
                setDealId(id);
                const d = deals.find((x) => x.id === id);
                if (d) setAdvertiserId(d.advertiserId);
              }}
              disabled={!advertiserId}
            >
              <option value="">— не привязывать —</option>
              {dealsOfClient.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Вся арифметика на виду: из-за её отсутствия и приходилось «подбивать». */}
        {deal && (
          <div className="rounded-xl border border-ink-700 bg-ink-900/60 p-3.5 text-sm">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
              <span className="text-ink-300">
                Договор <b className="text-ink-50">{formatMoney(toGross(planned))}</b>
              </span>
              <span className="text-ink-300">
                Разложено <b className="text-ink-50">{formatMoney(toGross(already))}</b>
              </span>
              {over > 0 ? (
                <span className="text-amber-300">
                  Лишнее <b>{formatMoney(toGross(over))}</b>
                </span>
              ) : (
                <span className="text-brand">
                  Осталось <b>{formatMoney(toGross(left))}</b>
                </span>
              )}
            </div>
            {left > 0 && (
              <button
                type="button"
                className="btn btn-ghost btn-sm mt-2.5"
                onClick={() => setAmount(String(left))}
              >
                Взять весь остаток
              </button>
            )}
            {over > 0 && (
              <p className="mt-2 text-xs text-amber-200/80">
                По этой сделке уже разложено больше, чем сумма договора. Лишние строки удаляются в
                календаре — нажмите на месяц с суммой.
              </p>
            )}
          </div>
        )}

        <NetAmountInput label="Сумма" value={amount} onChange={setAmount} required />

        {/* Два способа — двумя кнопками, а не галочкой: так видно, что выбор есть. */}
        <div>
          <label className="label">Как платят</label>
          <div className="grid gap-2 sm:grid-cols-2">
            {([
              ["once", "Одним платежом", "вся сумма в один месяц"],
              ["spread", "По месяцам", "равными частями, пока не покроем всю сумму"],
            ] as const).map(([value, title, hint]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={`rounded-xl border p-3 text-left transition ${
                  mode === value
                    ? "border-brand bg-brand/10"
                    : "border-ink-700 bg-ink-900/40 hover:border-ink-600"
                }`}
              >
                <div className="text-sm font-semibold text-ink-50">{title}</div>
                <div className="mt-0.5 text-xs text-ink-400">{hint}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">{mode === "once" ? "Месяц платежа *" : "Первый месяц *"}</label>
            <input
              className="input"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              required
            />
          </div>
          {mode === "spread" && (
            <div>
              <label className="label">На сколько месяцев *</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn-icon"
                  onClick={() => setMonthsCount((n) => Math.max(2, n - 1))}
                  aria-label="Меньше месяцев"
                >
                  −
                </button>
                <input
                  className="input w-20 text-center"
                  type="number"
                  min={2}
                  max={36}
                  value={monthsCount}
                  onChange={(e) => setMonthsCount(Number(e.target.value) || 2)}
                />
                <button
                  type="button"
                  className="btn-icon"
                  onClick={() => setMonthsCount((n) => Math.min(36, n + 1))}
                  aria-label="Больше месяцев"
                >
                  +
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Предпросмотр: видно, что именно появится в календаре. */}
        {parts.length > 0 && (
          <div className="rounded-xl border border-ink-800 bg-ink-900/40 p-3.5">
            <div className="text-xs font-medium uppercase tracking-wide text-ink-500">
              Получится
            </div>
            <div className="mt-1.5 text-sm text-ink-100">
              {parts.length === 1 ? (
                <>
                  один платёж {formatMoney(toGross(total))} в {monthLabel(parts[0].month)}
                </>
              ) : (
                <>
                  {parts.length} платежей с {monthLabel(parts[0].month)} по{" "}
                  {monthLabel(parts[parts.length - 1].month)} — по{" "}
                  {formatMoney(toGross(parts[0].amount))}
                  {parts[parts.length - 1].amount !== parts[0].amount && (
                    <>, последний {formatMoney(toGross(parts[parts.length - 1].amount))}</>
                  )}
                </>
              )}
            </div>
            <div className="mt-1 text-xs text-ink-500">
              всего {formatMoney(toGross(total))} с НДС · {formatMoney(total)} без НДС
            </div>
            {deal && total > left && over === 0 && (
              <div className="mt-2 text-xs text-amber-200">
                Это больше остатка по договору на {formatMoney(toGross(total - left))} — проверьте
                сумму, иначе календарь разойдётся с договором.
              </div>
            )}
          </div>
        )}

        {/* Статус и заметка нужны редко — под «Подробностями». */}
        <div>
          <button
            type="button"
            className="text-sm text-ink-400 transition hover:text-brand"
            onClick={() => setDetailsOpen((v) => !v)}
          >
            {detailsOpen ? "Скрыть подробности" : "Подробности: статус, заметка"}
          </button>
          {detailsOpen && (
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Статус</label>
                <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
                  {PLANNED_PAYMENT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Заметка</label>
                <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        <FormError message={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving || !advertiserId}>
            {saving
              ? "Создаю…"
              : parts.length > 1
                ? `Создать ${parts.length} платежей`
                : "Создать платёж"}
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
  deals = [],
  allPayments = [],
  onClose,
  onChanged,
}: {
  cell: { advertiserId: string; month: string } | null;
  advertisers: Adv[];
  /** Платежи ЭТОЙ клетки — их и показываем списком. */
  payments: PP[];
  deals?: DealOpt[];
  /** Все платежи — нужны окну «Разложить оплату» для расчёта остатка. */
  allPayments?: PP[];
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
                    {/* В базе лежит чистая сумма — показываем, во что она
                        превращается для счёта и бухгалтерии. */}
                    <div className="mt-1 text-xs text-ink-500">с НДС ≈ {formatMoney(toGross(p.amount))}</div>
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
        deals={deals}
        payments={allPayments}
        onSaved={onChanged}
        presetAdvertiserId={cell.advertiserId}
        presetMonth={cell.month}
      />
    </>
  );
}
