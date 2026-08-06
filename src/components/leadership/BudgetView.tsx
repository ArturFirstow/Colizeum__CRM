"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Pencil, ChevronLeft, ChevronRight, Check, Wallet, Plus, ChevronDown } from "lucide-react";
import { Modal, FormError } from "@/components/ui/Modal";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { apiFetch } from "@/lib/client";
import { formatMoney } from "@/lib/format";
import { INCOME_SOURCES, EXPENSE_CATEGORIES, EXPENSE_PERIODICITY, PAY_FORMATS } from "@/lib/enums";
import {
  netOfExpense, needsJustification, weekOfMonth, monthSummary,
  type ExpenseRow,
} from "@/lib/dept-budget";

type Income = { id: string; month: string; source: string; w1: number; w2: number; w3: number; w4: number };

const MONTHS_RU = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS_RU[(m ?? 1) - 1]} ${y}`;
}
function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// «Деньги отдела». Экран отвечает на три вопроса подряд, сверху вниз:
// 1. Сколько можно потратить и сколько уже разобрано → карточка месяца.
// 2. Что ждёт моего решения → блок согласования (кнопка прямо в строке).
// 3. Куда уходят деньги и что приходит → простые списки.
// Бухгалтерские детали (НДС, недели, акты) не мозолят глаза — они в строке
// расхода и в разделе «Подробности» формы.
// ─────────────────────────────────────────────────────────────────────────────
export function BudgetView({
  month,
  months,
  plannedBudget,
  incomes,
  expenses,
}: {
  month: string;
  months: string[];
  plannedBudget: number;
  incomes: Income[];
  expenses: ExpenseRow[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ExpenseRow | null>(null);
  const [addingIncome, setAddingIncome] = useState(false);

  const summary = useMemo(() => monthSummary(expenses), [expenses]);
  const incomeTotal = incomes.reduce((s, i) => s + i.w1 + i.w2 + i.w3 + i.w4, 0);
  const waiting = expenses.filter((e) => e.status === "Не согласовано");
  const settled = expenses.filter((e) => e.status !== "Не согласовано");
  const refresh = () => router.refresh();

  function goMonth(m: string) {
    router.push(`/leadership/budget?month=${m}`);
  }

  return (
    <div className="space-y-8">
      {/* Месяц: стрелками, как в календаре */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-xl border border-ink-700 bg-ink-900/60 p-1">
          <button className="btn-icon h-8 w-8 border-0 bg-transparent" onClick={() => goMonth(shiftMonth(month, -1))} title="Предыдущий месяц">
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-[9.5rem] text-center text-sm font-semibold capitalize text-ink-50">{monthLabel(month)}</span>
          <button className="btn-icon h-8 w-8 border-0 bg-transparent" onClick={() => goMonth(shiftMonth(month, 1))} title="Следующий месяц">
            <ChevronRight size={16} />
          </button>
        </div>
        {months.length > 1 && (
          <label className="flex items-center gap-2 text-sm text-ink-400">
            Перейти к
            <select className="input h-9 w-auto py-0 text-sm capitalize" value={month} onChange={(e) => goMonth(e.target.value)}>
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
          </label>
        )}
        <a href={`/api/dept/export?month=${month}`} className="btn btn-ghost btn-sm ml-auto">
          <Download size={14} /> Выгрузить в Excel
        </a>
      </div>

      {/* 1. Главная карточка: сколько осталось */}
      <MonthMoneyCard
        month={month}
        planned={plannedBudget}
        approved={summary.approvedTotal}
        spent={summary.spentTotal}
        income={incomeTotal}
        vat={summary.vatTotal}
        onSaved={refresh}
      />

      {/* 2. Что ждёт согласования */}
      {waiting.length > 0 && (
        <section>
          <SectionTitle
            title="Ждут вашего решения"
            hint={`${waiting.length} ${plural(waiting.length, "расход", "расхода", "расходов")} на ${formatMoney(summary.notApprovedTotal)}`}
            accent
          />
          <div className="stagger space-y-2">
            {waiting.map((e) => (
              <ExpenseLine key={e.id} expense={e} onEdit={() => setEditing(e)} onChanged={refresh} highlight />
            ))}
          </div>
        </section>
      )}

      {/* 3. Куда уходят деньги */}
      <section>
        <SectionTitle
          title="Куда уходят деньги"
          hint="Всё, что уже согласовано или оплачено в этом месяце"
          action={
            <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>
              <Plus size={14} /> Добавить расход
            </button>
          }
        />
        {settled.length === 0 ? (
          <EmptyHint
            text={waiting.length > 0 ? "Согласованных расходов пока нет." : `За ${monthLabel(month)} расходов ещё не заводили.`}
            hint="Нажмите «Добавить расход» — нужно всего название, сумма и дата оплаты."
          />
        ) : (
          <div className="stagger space-y-2">
            {settled.map((e) => (
              <ExpenseLine key={e.id} expense={e} onEdit={() => setEditing(e)} onChanged={refresh} />
            ))}
          </div>
        )}
      </section>

      {/* 4. Что приходит */}
      <section>
        <SectionTitle
          title="Что приходит"
          hint="План поступлений по неделям — сколько денег ждём"
          action={
            <button className="btn btn-ghost btn-sm" onClick={() => setAddingIncome(true)}>
              <Plus size={14} /> Источник дохода
            </button>
          }
        />
        {incomes.length === 0 ? (
          <EmptyHint
            text="Источники дохода не заведены."
            hint="Добавьте источник (например «Реклама») и впишите ожидаемые суммы по неделям."
          />
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-left text-xs uppercase tracking-wide text-ink-500">
                  <th className="px-4 py-2.5 font-medium">Откуда деньги</th>
                  <th className="px-3 py-2.5 text-right font-medium">1 неделя</th>
                  <th className="px-3 py-2.5 text-right font-medium">2 неделя</th>
                  <th className="px-3 py-2.5 text-right font-medium">3 неделя</th>
                  <th className="px-3 py-2.5 text-right font-medium">4 неделя</th>
                  <th className="px-4 py-2.5 text-right font-medium">Всего</th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-800">
                {incomes.map((i) => (
                  <IncomeRow key={i.id} income={i} onChanged={refresh} />
                ))}
                <tr className="bg-ink-900/40 font-semibold">
                  <td className="px-4 py-2.5 text-ink-200">Итого ждём</td>
                  {(["w1", "w2", "w3", "w4"] as const).map((w) => (
                    <td key={w} className="px-3 py-2.5 text-right text-ink-400">
                      {formatMoney(incomes.reduce((s, i) => s + i[w], 0))}
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-right text-brand">{formatMoney(incomeTotal)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
            <p className="border-t border-ink-800 px-4 py-2.5 text-xs text-ink-500">
              Суммы правятся прямо в таблице — кликните по числу и введите новое.
            </p>
          </div>
        )}
      </section>

      {(adding || editing) && (
        <ExpenseModal
          month={month}
          expense={editing}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSaved={refresh}
        />
      )}
      {addingIncome && <IncomeModal month={month} onClose={() => setAddingIncome(false)} onSaved={refresh} />}
    </div>
  );
}

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

function SectionTitle({
  title,
  hint,
  action,
  accent,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className={`font-display text-lg font-semibold uppercase tracking-wide ${accent ? "text-brand" : "text-ink-50"}`}>
          {title}
        </h2>
        {hint && <p className="mt-0.5 text-sm text-ink-400">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

function EmptyHint({ text, hint }: { text: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-700 bg-ink-900/30 px-6 py-8 text-center">
      <div className="text-sm text-ink-200">{text}</div>
      <div className="mt-1 text-xs text-ink-500">{hint}</div>
    </div>
  );
}

// ── Карточка месяца: одна большая цифра + полоса ─────────────────────────────
function MonthMoneyCard({
  month,
  planned,
  approved,
  spent,
  income,
  vat,
  onSaved,
}: {
  month: string;
  planned: number;
  approved: number;
  spent: number;
  income: number;
  vat: number;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(planned || ""));
  const [busy, setBusy] = useState(false);
  const left = planned - approved;
  const usedPct = planned > 0 ? Math.min(100, Math.round((approved / planned) * 100)) : 0;
  const over = left < 0;

  async function save() {
    setBusy(true);
    try {
      await apiFetch("/api/dept/budget", { method: "PUT", body: JSON.stringify({ month, plannedBudget: Number(val) || 0 }) });
      setEditing(false);
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card relative overflow-hidden p-6">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand/10 blur-3xl" />
      <div className="relative">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-400">
          <Wallet size={14} className="text-brand" /> Свободно в этом месяце
        </div>

        {planned > 0 ? (
          <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-1">
            <div className={`font-display text-4xl font-semibold ${over ? "text-red-300" : "text-brand"}`}>
              {formatMoney(Math.abs(left))}
            </div>
            <div className="pb-1.5 text-sm text-ink-400">
              {over ? "перерасход сверх плана" : "из плана"} <b className="text-ink-200">{formatMoney(planned)}</b>
            </div>
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <div className="font-display text-2xl font-semibold text-ink-200">План на месяц не задан</div>
            {!editing && (
              <button className="btn btn-primary btn-sm" onClick={() => setEditing(true)}>
                Задать план
              </button>
            )}
          </div>
        )}

        {/* Полоса: сколько плана уже разобрано */}
        {planned > 0 && (
          <div className="mt-4">
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-ink-800">
              <div
                className={`h-full rounded-full transition-[width] duration-700 ease-out ${over ? "bg-red-400/80" : "bg-brand"}`}
                style={{ width: `${usedPct}%` }}
              />
            </div>
            <div className="mt-1.5 text-xs text-ink-500">
              Согласовано {formatMoney(approved)} — это {usedPct}% плана
            </div>
          </div>
        )}

        {/* Три спокойные подписи вместо россыпи плиток */}
        <div className="mt-5 grid gap-4 border-t border-ink-800 pt-4 sm:grid-cols-3">
          <Metric label="Ждём прихода" value={income} hint="план поступлений" />
          <Metric label="Уже потрачено" value={spent} hint="по факту" />
          <div>
            <div className="text-xs uppercase tracking-wide text-ink-500">План на месяц</div>
            {editing ? (
              <div className="mt-1 flex gap-1.5">
                <input
                  className="input h-8 w-full text-sm"
                  type="number"
                  value={val}
                  onChange={(e) => setVal(e.target.value)}
                  placeholder="например 3000000"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && save()}
                />
                <button className="btn btn-primary btn-sm shrink-0" disabled={busy} onClick={save}>
                  ОК
                </button>
              </div>
            ) : (
              <button
                className="group mt-1 flex items-center gap-1.5 text-lg font-semibold text-ink-100 hover:text-brand"
                onClick={() => setEditing(true)}
              >
                {planned > 0 ? formatMoney(planned) : "задать"}
                <Pencil size={12} className="opacity-0 transition group-hover:opacity-100" />
              </button>
            )}
            <div className="mt-0.5 text-[11px] text-ink-500">сколько отдел может потратить</div>
          </div>
        </div>

        {vat > 0 && (
          <div className="mt-3 text-xs text-ink-500">
            В согласованных расходах НДС: <b className="text-ink-300">{formatMoney(vat)}</b>
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-ink-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-ink-100">{formatMoney(value)}</div>
      <div className="mt-0.5 text-[11px] text-ink-500">{hint}</div>
    </div>
  );
}

// ── Строка расхода: читается как предложение, действия под рукой ─────────────
function ExpenseLine({
  expense: e,
  onEdit,
  onChanged,
  highlight,
}: {
  expense: ExpenseRow;
  onEdit: () => void;
  onChanged: () => void;
  highlight?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const week = weekOfMonth(e.payDate);

  async function setStatus(status: string) {
    setBusy(true);
    try {
      await apiFetch(`/api/dept/expenses/${e.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`card card-hover group flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 ${
        highlight ? "!border-brand/35 !bg-brand/[0.05]" : ""
      } ${busy ? "opacity-50" : ""}`}
    >
      <div className="min-w-[12rem] flex-1">
        <div className="font-medium text-ink-50">{e.title}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-500">
          {e.category && <span>{e.category}</span>}
          {e.legalEntity && <span>· {e.legalEntity}</span>}
          {e.payDate && (
            <span>
              · оплата {new Date(e.payDate).toLocaleDateString("ru-RU")}
              {week ? ` (${week}-я неделя)` : ""}
            </span>
          )}
          {e.status === "Оплачено" && <span className="text-emerald-400">· оплачено</span>}
        </div>
      </div>

      <div className="text-right">
        <div className="font-display text-lg font-semibold text-ink-50">{formatMoney(e.amountTotal)}</div>
        <div className="text-[11px] text-ink-500">
          {e.vatRate === 22 ? `в т.ч. НДС · без НДС ${formatMoney(netOfExpense(e.amountTotal, e.vatRate))}` : "без НДС"}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {e.status === "Не согласовано" && (
          <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => setStatus("Согласовано")}>
            <Check size={14} /> Согласовать
          </button>
        )}
        {e.status === "Согласовано" && (
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setStatus("Оплачено")} title="Отметить, что деньги ушли">
            Оплачено
          </button>
        )}
        <button className="btn-icon h-8 w-8 text-ink-400 hover:text-brand" onClick={onEdit} title="Изменить">
          <Pencil size={13} />
        </button>
        <DeleteButton endpoint={`/api/dept/expenses/${e.id}`} what={`расход «${e.title}»`} />
      </div>
    </div>
  );
}

// ── Форма расхода: главное сразу, бухгалтерия — по кнопке ────────────────────
function ExpenseModal({
  month,
  expense,
  onClose,
  onSaved,
}: {
  month: string;
  expense: ExpenseRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dateVal = (v: string | Date | null) => (v ? new Date(v).toISOString().slice(0, 10) : "");
  const [f, setF] = useState({
    title: expense?.title ?? "",
    category: expense?.category ?? EXPENSE_CATEGORIES[0],
    accountingSub: expense?.accountingSub ?? "",
    legalEntity: expense?.legalEntity ?? "",
    department: expense?.department ?? "",
    periodicity: expense?.periodicity ?? EXPENSE_PERIODICITY[0],
    vatRate: String(expense?.vatRate ?? 0),
    amountTotal: expense?.amountTotal ? String(expense.amountTotal) : "",
    spentTotal: expense?.spentTotal != null ? String(expense.spentTotal) : "",
    payFormat: expense?.payFormat ?? PAY_FORMATS[0],
    payDate: dateVal(expense?.payDate ?? null),
    deliveryDate: dateVal(expense?.deliveryDate ?? null),
    serviceEndDate: dateVal(expense?.serviceEndDate ?? null),
    actClosedDate: dateVal(expense?.actClosedDate ?? null),
    justification: expense?.justification ?? "",
    description: expense?.description ?? "",
    status: expense?.status ?? "Не согласовано",
  });
  const [details, setDetails] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof f>(k: K, v: string) {
    setF((s) => ({ ...s, [k]: v }));
  }

  const amount = Number(f.amountTotal) || 0;
  const vatRate = Number(f.vatRate);
  const net = netOfExpense(amount, vatRate);
  const warnJust = needsJustification(f.payDate || null, f.deliveryDate || null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (warnJust && !f.justification.trim()) {
      setDetails(true);
      setError("Оплата и поставка расходятся больше чем на 2 недели — напишите в «Подробностях», почему так.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        month,
        title: f.title,
        category: f.category,
        accountingSub: f.accountingSub || undefined,
        legalEntity: f.legalEntity || undefined,
        department: f.department || undefined,
        periodicity: f.periodicity,
        vatRate,
        amountTotal: amount,
        spentTotal: f.spentTotal ? Number(f.spentTotal) : undefined,
        payFormat: f.payFormat,
        payDate: f.payDate || "",
        deliveryDate: f.deliveryDate || "",
        serviceEndDate: f.serviceEndDate || "",
        actClosedDate: f.actClosedDate || "",
        justification: f.justification || undefined,
        description: f.description || undefined,
        status: f.status,
      };
      if (expense) {
        const { month: _m, ...rest } = payload;
        await apiFetch(`/api/dept/expenses/${expense.id}`, { method: "PATCH", body: JSON.stringify(rest) });
      } else {
        await apiFetch("/api/dept/expenses", { method: "POST", body: JSON.stringify(payload) });
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
      title={expense ? "Изменить расход" : "Новый расход"}
      subtitle="Заполните четыре поля сверху — этого достаточно. Остальное можно добавить позже."
      size="lg"
    >
      <form onSubmit={submit} className="space-y-5">
        <div>
          <label className="label">За что платим *</label>
          <input
            className="input"
            value={f.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Например: печать баннеров для турнира"
            required
            autoFocus
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Сколько, ₽ *</label>
            <input
              className="input"
              type="number"
              value={f.amountTotal}
              onChange={(e) => set("amountTotal", e.target.value)}
              placeholder="45000"
              required
            />
            <p className="mt-1 text-xs text-ink-500">Полная сумма к оплате, как в счёте.</p>
          </div>
          <div>
            <label className="label">Когда платим</label>
            <input className="input" type="date" value={f.payDate} onChange={(e) => set("payDate", e.target.value)} />
            <p className="mt-1 text-xs text-ink-500">Дата списания — по ней расход попадёт в нужную неделю.</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Статья расхода</label>
            <select className="input" value={f.category} onChange={(e) => set("category", e.target.value)}>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Сумма с НДС?</label>
            <select className="input" value={f.vatRate} onChange={(e) => set("vatRate", e.target.value)}>
              <option value="0">Без НДС</option>
              <option value="22">В сумме есть НДС 22 %</option>
            </select>
          </div>
        </div>

        {amount > 0 && (
          <div className="rounded-xl border border-ink-800 bg-ink-900/60 px-4 py-2.5 text-sm text-ink-300">
            {vatRate === 22 ? (
              <>
                Без НДС <b className="text-ink-100">{formatMoney(net)}</b> · НДС{" "}
                <b className="text-ink-100">{formatMoney(amount - net)}</b>
              </>
            ) : (
              <>
                К оплате <b className="text-ink-100">{formatMoney(amount)}</b>, НДС нет
              </>
            )}
          </div>
        )}

        {/* Подробности — не нужны, чтобы завести расход */}
        <div className="rounded-xl border border-ink-800">
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-ink-200 hover:text-brand"
            onClick={() => setDetails((v) => !v)}
          >
            <span>Подробности для бухгалтерии {warnJust && !f.justification && <span className="text-amber-300">· нужно обоснование</span>}</span>
            <ChevronDown size={16} className={`transition-transform duration-200 ${details ? "rotate-180" : ""}`} />
          </button>
          {details && (
            <div className="space-y-4 border-t border-ink-800 px-4 py-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Кому платим (юр.лицо)</label>
                  <input
                    className="input"
                    value={f.legalEntity}
                    onChange={(e) => set("legalEntity", e.target.value)}
                    placeholder="ИП Иванов / ООО «Ромашка»"
                  />
                </div>
                <div>
                  <label className="label">Как платим</label>
                  <select className="input" value={f.payFormat} onChange={(e) => set("payFormat", e.target.value)}>
                    {PAY_FORMATS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Это разовый расход или повторяющийся</label>
                  <select className="input" value={f.periodicity} onChange={(e) => set("periodicity", e.target.value)}>
                    {EXPENSE_PERIODICITY.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Когда получим товар/услугу</label>
                  <input className="input" type="date" value={f.deliveryDate} onChange={(e) => set("deliveryDate", e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label">
                  Почему платим заранее{" "}
                  {warnJust && <span className="text-amber-300">— обязательно: между оплатой и поставкой больше 2 недель</span>}
                </label>
                <textarea
                  className="input"
                  value={f.justification}
                  onChange={(e) => set("justification", e.target.value)}
                  placeholder="Например: предоплата фиксирует цену до повышения"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Потрачено по факту, ₽</label>
                  <input
                    className="input"
                    type="number"
                    value={f.spentTotal}
                    onChange={(e) => set("spentTotal", e.target.value)}
                    placeholder="если отличается от суммы"
                  />
                </div>
                <div>
                  <label className="label">Дата закрытия актом</label>
                  <input className="input" type="date" value={f.actClosedDate} onChange={(e) => set("actClosedDate", e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label">Комментарий</label>
                <textarea
                  className="input"
                  value={f.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="Всё, что важно помнить про этот расход"
                />
              </div>
            </div>
          )}
        </div>

        <FormError message={error} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-ink-300">
            <input
              type="checkbox"
              className="h-4 w-4 accent-brand"
              checked={f.status !== "Не согласовано"}
              onChange={(e) => set("status", e.target.checked ? "Согласовано" : "Не согласовано")}
            />
            Сразу согласовать
          </label>
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Сохраняю…" : "Сохранить"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

// ── Доходы ───────────────────────────────────────────────────────────────────
function IncomeRow({ income, onChanged }: { income: Income; onChanged: () => void }) {
  const total = income.w1 + income.w2 + income.w3 + income.w4;
  async function patchWeek(field: "w1" | "w2" | "w3" | "w4", value: number) {
    await apiFetch(`/api/dept/income/${income.id}`, { method: "PATCH", body: JSON.stringify({ [field]: value }) });
    onChanged();
  }
  return (
    <tr className="transition hover:bg-ink-800/40">
      <td className="px-4 py-2 font-medium text-ink-100">{income.source}</td>
      {(["w1", "w2", "w3", "w4"] as const).map((w) => (
        <td key={w} className="px-3 py-1.5 text-right">
          <input
            className="input h-8 w-24 text-right font-mono text-xs"
            type="number"
            defaultValue={income[w] || ""}
            placeholder="0"
            onBlur={(e) => {
              const v = Number(e.target.value) || 0;
              if (v !== income[w]) patchWeek(w, v);
            }}
          />
        </td>
      ))}
      <td className="px-4 py-2 text-right font-mono font-semibold text-ink-100">{formatMoney(total)}</td>
      <td className="px-3 py-2 text-right">
        <DeleteButton endpoint={`/api/dept/income/${income.id}`} what={`доход «${income.source}»`} />
      </td>
    </tr>
  );
}

function IncomeModal({ month, onClose, onSaved }: { month: string; onClose: () => void; onSaved: () => void }) {
  const [source, setSource] = useState(INCOME_SOURCES[0] as string);
  const [custom, setCustom] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const src = source === "__custom__" ? custom.trim() : source;
      if (!src) throw new Error("Укажите источник");
      await apiFetch("/api/dept/income", { method: "POST", body: JSON.stringify({ month, source: src }) });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Откуда ждём деньги" size="sm">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Источник дохода</label>
          <select className="input" value={source} onChange={(e) => setSource(e.target.value)}>
            {INCOME_SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            <option value="__custom__">Свой вариант…</option>
          </select>
          {source === "__custom__" && (
            <input
              className="input mt-2"
              placeholder="Название источника"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              autoFocus
            />
          )}
        </div>
        <p className="text-xs text-ink-500">Суммы по неделям впишете в таблице — сразу после добавления.</p>
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
