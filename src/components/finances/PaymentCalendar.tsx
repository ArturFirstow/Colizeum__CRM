"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, FormError } from "@/components/ui/Modal";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { apiFetch } from "@/lib/client";
import { PLANNED_PAYMENT_STATUSES } from "@/lib/enums";
import { formatMoney, plural } from "@/lib/format";
import { toGross } from "@/components/ui/Money";
import { NetAmountInput } from "@/components/ui/NetAmountInput";
import { PaymentChart, type PaymentBar } from "@/components/finances/PaymentChart";
import { compactMoney, currentMonth, monthLabel, monthRange, shiftMonthStr } from "@/lib/month";

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

/** Строка плана, который собирается в окне (ещё не в базе). Сумма ЧИСТАЯ. */
type PlanRow = { key: string; month: string; amount: number; note: string };

/** Текст в число: «1 200 000» и «1200000,5» → 1200000. */
function parseAmount(text: string): number {
  return Math.round(Number(String(text).replace(/\s/g, "").replace(",", ".")) || 0);
}

/**
 * Разделить сумму на N месяцев равными частями.
 * ⚠️ Остаток от деления уходит в ПОСЛЕДНИЙ месяц — иначе сумма частей не
 * сходится с суммой договора, а именно это и приходилось «подбивать руками».
 */
function splitAmount(total: number, count: number, from: string, label: (i: number, n: number) => string): PlanRow[] {
  const n = Math.max(1, Math.min(36, count));
  const base = Math.floor(total / n);
  return Array.from({ length: n }, (_, i) => ({
    key: `${from}-${i}-${Math.random().toString(36).slice(2, 7)}`,
    month: shiftMonthStr(from, i),
    amount: i === n - 1 ? total - base * (n - 1) : base,
    note: label(i + 1, n),
  }));
}

/** Платежи (как лежат в базе) → столбики графика по месяцам. */
function toBars(payments: { periodMonth: string; amount: number; status: string }[]): PaymentBar[] {
  if (payments.length === 0) return [];
  const sorted = [...payments].map((p) => p.periodMonth).sort();
  const months = monthRange(sorted[0], sorted[sorted.length - 1]);
  return months.map((m) => {
    const inMonth = payments.filter((p) => p.periodMonth === m);
    return {
      month: m,
      paid: inMonth.filter((p) => p.status === "Оплачено").reduce((s, p) => s + p.amount, 0),
      overdue: inMonth.filter((p) => p.status === "Просрочено").reduce((s, p) => s + p.amount, 0),
      planned: inMonth
        .filter((p) => p.status !== "Оплачено" && p.status !== "Просрочено")
        .reduce((s, p) => s + p.amount, 0),
    };
  });
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

  const bars = useMemo(() => toBars(payments), [payments]);

  function cellPayments(advertiserId: string, month: string) {
    return payments.filter((p) => p.advertiserId === advertiserId && p.periodMonth === month);
  }

  const colTotals = months.map((m) => payments.filter((p) => p.periodMonth === m).reduce((s, p) => s + p.amount, 0));
  const grandTotal = payments.reduce((s, p) => s + p.amount, 0);

  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        {/* Заголовка карточки нет намеренно: страница уже называется «Оплаты».
            Остаётся только то, чего из названия не понять. */}
        <p className="max-w-3xl text-xs text-ink-500">
          Кто, сколько и когда платит — по месяцам. Это разбивка бюджета по срокам, а не деньги
          сверх него: справа видно, сколько разложено из бюджета по карточкам сделок.
        </p>
        <button className="btn btn-primary btn-sm" onClick={() => setAddOpen(true)}>
          + Разложить оплату
        </button>
      </div>

      {/* Общая картина — сначала график, потом та же цифра по клиентам таблицей.
          Сам по себе календарь отвечает «кто и когда», а «ровно ли лежат
          деньги по месяцам» видно только картинкой. */}
      {payments.length > 0 && (
        <div className="mb-5 rounded-xl border border-ink-800 bg-ink-900/40 p-4">
          <PaymentChart bars={bars} />
        </div>
      )}

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
                            {compactMoney(toGross(total))}
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
                    {t > 0 ? compactMoney(toGross(t)) : ""}
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
// «Разложить оплату» — конструктор плана платежей по сделке.
//
// КАК БЫЛО. Форма спрашивала клиента, месяц и сумму. Всю арифметику человек
// держал в голове: сколько по договору, сколько уже разложено, сколько
// осталось, — и в сервисе регулярно оказывалось разложено БОЛЬШЕ суммы
// договора. Сходилось это руками, «подбиванием».
//
// КАК СТАЛО. Окно считает само и ведёт за руку до остатка 0:
//   1. выбрал сделку — видно «договор / уже разложено / осталось»;
//   2. нажал схему оплаты — план собрался целиком;
//   3. строки правятся: месяц, сумма, подпись; остаток пересчитывается на ходу;
//   4. остаток не 0 — одна кнопка «добавить платёж на остаток» или
//      «разбить остаток на N месяцев»;
//   5. под строками — тот же график, что на странице: видно, ровно ли легли
//      деньги по месяцам, ДО сохранения.
//
// ТРИ СХЕМЫ — те, которыми работают в агентстве (список дал пользователь, не
// выдумывать): 100 % предоплата; 50 % предоплата + 50 % постоплата с ВЫБОРОМ
// месяца; равными частями по месяцам. Четвёртая кнопка — «своя схема»: под
// смешанные случаи вроде «50 % предоплатой за первые три месяца, остальное
// тремя равными частями». Схема — это заготовка строк, а не отдельная сущность
// в базе: любую можно поправить после нажатия.
//
// ⚠️ Суммы плановых платежей лежат в базе ЧИСТЫМИ (без НДС) — как и везде по
// правилу сервиса. Поэтому и остаток считается в чистых, а на экране рядом
// показывается сумма с НДС.
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
  const thisMonth = currentMonth();
  const [advertiserId, setAdvertiserId] = useState(presetAdvertiserId ?? "");
  const [dealId, setDealId] = useState("");
  const [baseInput, setBaseInput] = useState("");
  const [startMonth, setStartMonth] = useState(presetMonth ?? thisMonth);
  const [term, setTerm] = useState(3);
  const [scheme, setScheme] = useState<string | null>(null);
  const [rows, setRows] = useState<PlanRow[]>([]);
  const [spreadCount, setSpreadCount] = useState(3);
  const [status, setStatus] = useState("План");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dealsOfClient = deals.filter((d) => !advertiserId || d.advertiserId === advertiserId);
  const deal = deals.find((d) => d.id === dealId);

  // Сколько уже разложено ранее: по сделке — её платежи, иначе по всему клиенту.
  const already = payments
    .filter((p) => (dealId ? p.dealId === dealId : advertiserId && p.advertiserId === advertiserId))
    .reduce((s, p) => s + p.amount, 0);
  const contract = deal?.budgetNet ?? 0;
  const leftByContract = Math.max(0, contract - already);
  const over = Math.max(0, already - contract);

  // Распределяем не «сумму договора», а то, что стоит в поле: обычно это
  // остаток по договору, но клиент может платить и часть — тогда цифру правят.
  const base = parseAmount(baseInput);
  const distributed = rows.reduce((s, r) => s + r.amount, 0);
  const remaining = base - distributed;
  const lastMonth = rows.length > 0 ? rows[rows.length - 1].month : null;
  const nextMonth = lastMonth ? shiftMonthStr(lastMonth, 1) : startMonth;

  // Предпросмотр строится из строк плана и показывает пустые месяцы внутри
  // периода: «в декабре не платят» — это тоже часть картины.
  const previewBars = useMemo(
    () =>
      toBars(
        rows
          .filter((r) => r.amount > 0 && /^\d{4}-\d{2}$/.test(r.month))
          .map((r) => ({ periodMonth: r.month, amount: r.amount, status })),
      ),
    [rows, status],
  );

  function pickDeal(id: string) {
    setDealId(id);
    const d = deals.find((x) => x.id === id);
    if (d) {
      setAdvertiserId(d.advertiserId);
      const rest = Math.max(0, d.budgetNet - payments.filter((p) => p.dealId === id).reduce((s, p) => s + p.amount, 0));
      setBaseInput(rest > 0 ? String(rest) : "");
      setRows([]);
      setScheme(null);
    }
  }

  function applyScheme(id: string) {
    setScheme(id);
    setError(null);
    if (id === "custom") {
      setRows([]);
      return;
    }
    if (base <= 0) {
      setError("Сначала укажите сумму, которую нужно распределить");
      return;
    }
    if (id === "prepay") {
      setRows([
        { key: `p-${Date.now()}`, month: startMonth, amount: base, note: "Предоплата 100 %" },
      ]);
      return;
    }
    if (id === "half") {
      const half = Math.round(base / 2);
      setRows([
        { key: `h1-${Date.now()}`, month: startMonth, amount: half, note: "Предоплата 50 %" },
        {
          key: `h2-${Date.now()}`,
          // Постоплата по умолчанию — последний месяц срока услуг; месяц
          // остаётся в поле строки, его и правят, если договорились иначе.
          month: shiftMonthStr(startMonth, Math.max(1, term - 1)),
          amount: base - half,
          note: "Постоплата 50 %",
        },
      ]);
      return;
    }
    if (id === "equal") {
      setRows(splitAmount(base, term, startMonth, (i, n) => `Платёж ${i} из ${n}`));
    }
  }

  function addRemainderRow() {
    if (remaining <= 0) return;
    setRows((rs) => [
      ...rs,
      { key: `r-${Date.now()}`, month: nextMonth, amount: remaining, note: "" },
    ]);
    setScheme("custom");
  }

  function spreadRemainder() {
    if (remaining <= 0) return;
    setRows((rs) => [
      ...rs,
      ...splitAmount(remaining, spreadCount, nextMonth, (i, n) => `Платёж ${i} из ${n}`),
    ]);
    setScheme("custom");
  }

  function patchRow(key: string, patch: Partial<PlanRow>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function reset() {
    setAdvertiserId(presetAdvertiserId ?? "");
    setDealId("");
    setBaseInput("");
    setStartMonth(presetMonth ?? thisMonth);
    setTerm(3);
    setScheme(null);
    setRows([]);
    setSpreadCount(3);
    setStatus("План");
    setDetailsOpen(false);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const ready = rows.filter((r) => r.amount > 0 && /^\d{4}-\d{2}$/.test(r.month));
    if (ready.length === 0) {
      setError("План пустой: выберите схему оплаты или добавьте платёж");
      return;
    }
    setSaving(true);
    try {
      for (const r of ready) {
        await apiFetch("/api/planned-payments", {
          method: "POST",
          body: JSON.stringify({
            advertiserId,
            dealId: dealId || undefined,
            periodMonth: r.month,
            amount: r.amount,
            status,
            note: r.note || undefined,
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

  const fits = Math.abs(remaining) <= 1; // копейки от деления ошибкой не считаем
  const progress = base > 0 ? Math.min(100, Math.round((distributed / base) * 100)) : 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Разложить оплату"
      subtitle="Сумма договора → месяцы, в которых её ждём. Остаток считается сам"
      size="lg"
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
                setRows([]);
                setScheme(null);
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
              onChange={(e) => pickDeal(e.target.value)}
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
                Договор <b className="text-ink-50">{formatMoney(toGross(contract))}</b>
              </span>
              <span className="text-ink-300">
                Было разложено <b className="text-ink-50">{formatMoney(toGross(already))}</b>
              </span>
              {over > 0 ? (
                <span className="text-amber-300">
                  Лишнее <b>{formatMoney(toGross(over))}</b>
                </span>
              ) : (
                <span className="text-brand">
                  Осталось разложить <b>{formatMoney(toGross(leftByContract))}</b>
                </span>
              )}
            </div>
            {over > 0 && (
              <p className="mt-2 text-xs text-amber-200/80">
                По этой сделке уже разложено больше суммы договора. Лишние строки удаляются в
                календаре — нажмите на месяц с суммой.
              </p>
            )}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <NetAmountInput
              label="Сумма к распределению"
              value={baseInput}
              onChange={(v) => setBaseInput(v)}
              required
            />
            {deal && leftByContract > 0 && parseAmount(baseInput) !== leftByContract && (
              <button
                type="button"
                className="btn btn-ghost btn-sm mt-2"
                onClick={() => setBaseInput(String(leftByContract))}
              >
                Взять весь остаток по договору
              </button>
            )}
          </div>
          <div>
            <label className="label">Первый месяц *</label>
            <input
              className="input"
              type="month"
              value={startMonth}
              onChange={(e) => setStartMonth(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Схемы оплаты — те, которыми работают в агентстве. */}
        <div>
          <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
            <label className="label !mb-0">Схема оплаты</label>
            <label className="flex items-center gap-2 text-xs text-ink-400">
              срок услуг
              <input
                className="input h-9 w-16 text-center"
                type="number"
                min={1}
                max={36}
                value={term}
                onChange={(e) => setTerm(Math.max(1, Math.min(36, Number(e.target.value) || 1)))}
              />
              мес.
            </label>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                ["prepay", "100 % предоплата", "вся сумма в первый месяц"],
                ["half", "50 % / 50 %", `предоплата + постоплата в ${monthLabel(shiftMonthStr(startMonth, Math.max(1, term - 1)))}`],
                ["equal", "Равными по месяцам", `${term} ${plural(term, "платёж", "платежа", "платежей")} подряд`],
                ["custom", "Своя схема", "собрать строки руками"],
              ] as const
            ).map(([id, title, hint]) => (
              <button
                key={id}
                type="button"
                onClick={() => applyScheme(id)}
                className={`rounded-xl border p-3 text-left transition ${
                  scheme === id
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

        {/* Полоса остатка — главный прибор этого окна: заполняем, пока не 0. */}
        {base > 0 && (
          <div
            className={`rounded-xl border p-3.5 ${
              fits ? "border-emerald-500/40 bg-emerald-500/[0.07]" : "border-ink-700 bg-ink-900/60"
            }`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
              <span className="text-ink-300">
                Распределено <b className="text-ink-50">{formatMoney(toGross(distributed))}</b>{" "}
                <span className="text-ink-500">из {formatMoney(toGross(base))}</span>
              </span>
              {fits ? (
                <span className="font-semibold text-emerald-300">Остаток 0 — сходится</span>
              ) : remaining > 0 ? (
                <span className="font-semibold text-amber-300">
                  Осталось {formatMoney(toGross(remaining))}
                </span>
              ) : (
                <span className="font-semibold text-red-300">
                  Перебор {formatMoney(toGross(-remaining))}
                </span>
              )}
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-800">
              <div
                className={`h-full rounded-full transition-[width] duration-300 ${
                  remaining < -1 ? "bg-red-500" : fits ? "bg-emerald-500" : "bg-brand"
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
            {remaining > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button type="button" className="btn btn-ghost btn-sm" onClick={addRemainderRow}>
                  + Платёж на остаток в {monthLabel(nextMonth)}
                </button>
                <span className="flex items-center gap-1.5 text-xs text-ink-400">
                  или разбить остаток на
                  <input
                    className="input h-9 w-14 text-center"
                    type="number"
                    min={2}
                    max={36}
                    value={spreadCount}
                    onChange={(e) =>
                      setSpreadCount(Math.max(2, Math.min(36, Number(e.target.value) || 2)))
                    }
                  />
                  мес.
                  <button type="button" className="btn btn-ghost btn-sm" onClick={spreadRemainder}>
                    Разбить
                  </button>
                </span>
              </div>
            )}
          </div>
        )}

        {/* Сами строки плана — правятся как в таблице. */}
        {rows.length > 0 && (
          <div className="rounded-xl border border-ink-800">
            <div className="grid grid-cols-[8.75rem_1fr_1.4fr_2.5rem] gap-2 border-b border-ink-800 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-ink-500">
              <span>Месяц</span>
              <span>Сумма без НДС</span>
              <span>Подпись</span>
              <span />
            </div>
            <div className="divide-y divide-ink-800/70">
              {rows.map((r) => (
                <div key={r.key} className="grid grid-cols-[8.75rem_1fr_1.4fr_2.5rem] items-center gap-2 px-3 py-2">
                  <input
                    className="input h-9 px-2 text-xs"
                    type="month"
                    value={r.month}
                    onChange={(e) => patchRow(r.key, { month: e.target.value })}
                  />
                  <div>
                    <input
                      className="input h-9 tabular-nums"
                      type="number"
                      min={0}
                      value={r.amount}
                      onChange={(e) => patchRow(r.key, { amount: Math.max(0, Number(e.target.value) || 0) })}
                    />
                    <div className="mt-0.5 text-[11px] text-ink-500">
                      с НДС {formatMoney(toGross(r.amount))}
                    </div>
                  </div>
                  <input
                    className="input h-9 text-xs"
                    placeholder="например, предоплата"
                    value={r.note}
                    onChange={(e) => patchRow(r.key, { note: e.target.value })}
                  />
                  <button
                    type="button"
                    className="btn-icon text-ink-500 hover:text-red-400"
                    title="Убрать строку"
                    onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-ink-800 px-3 py-2 text-sm">
              <span className="text-ink-400">
                {rows.length} {plural(rows.length, "платёж", "платежа", "платежей")} ·{" "}
                {monthLabel(rows[0].month)} — {monthLabel(rows[rows.length - 1].month)}
              </span>
              <span className="font-semibold text-ink-50">
                {formatMoney(toGross(distributed))}
                <span className="ml-2 text-xs font-normal text-ink-500">
                  без НДС {formatMoney(distributed)}
                </span>
              </span>
            </div>
          </div>
        )}

        {/* Та же картинка, что на странице, — но ещё до сохранения. */}
        {previewBars.length > 0 && (
          <div className="rounded-xl border border-ink-800 bg-ink-900/40 p-3.5">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-500">
              Как ляжет по месяцам
            </div>
            <PaymentChart bars={previewBars} summary={false} height={110} />
          </div>
        )}

        {/* Статус и подробности нужны редко — под кнопкой. */}
        <div>
          <button
            type="button"
            className="text-sm text-ink-400 transition hover:text-brand"
            onClick={() => setDetailsOpen((v) => !v)}
          >
            {detailsOpen ? "Скрыть подробности" : "Подробности: статус платежей"}
          </button>
          {detailsOpen && (
            <div className="mt-3 max-w-xs">
              <label className="label">Статус всех строк</label>
              <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
                {PLANNED_PAYMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-ink-500">
                Потом статус меняется у каждого платежа отдельно — в календаре по клику на месяц.
              </p>
            </div>
          )}
        </div>

        {!fits && rows.length > 0 && (
          <p className="text-xs text-amber-200">
            {remaining > 0
              ? `План покрывает не всю сумму: не разложено ${formatMoney(toGross(remaining))}. Так тоже можно — остальное добавите позже.`
              : `Разложено больше суммы на ${formatMoney(toGross(-remaining))} — проверьте строки, иначе календарь разойдётся с договором.`}
          </p>
        )}

        <FormError message={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Отмена
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving || !advertiserId || rows.length === 0}
          >
            {saving
              ? "Создаю…"
              : rows.length > 1
                ? `Создать ${rows.length} ${plural(rows.length, "платёж", "платежа", "платежей")}`
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
