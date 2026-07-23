"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Pencil } from "lucide-react";
import { Modal, FormError } from "@/components/ui/Modal";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { apiFetch } from "@/lib/client";
import { formatMoney } from "@/lib/format";
import { INCOME_SOURCES, EXPENSE_CATEGORIES, EXPENSE_STATUSES, EXPENSE_PERIODICITY, PAY_FORMATS } from "@/lib/enums";
import {
  netOfExpense, vatOfExpense, daysBetween, needsJustification, weekOfMonth, monthSummary,
  type ExpenseRow,
} from "@/lib/dept-budget";

type Income = { id: string; month: string; source: string; w1: number; w2: number; w3: number; w4: number };

const MONTHS_RU = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS_RU[(m ?? 1) - 1]} ${y}`;
}

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
  const [tab, setTab] = useState<"income" | "expense">("expense");

  const summary = useMemo(() => monthSummary(expenses), [expenses]);
  const incomeTotal = incomes.reduce((s, i) => s + i.w1 + i.w2 + i.w3 + i.w4, 0);
  const balance = incomeTotal - summary.approvedTotal;
  const budgetLeft = plannedBudget - summary.approvedTotal;

  function goMonth(m: string) {
    router.push(`/leadership/budget?month=${m}`);
  }

  return (
    <div>
      {/* Переключатель месяца + выгрузка */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-ink-400">Месяц:</label>
          <input
            type="month"
            className="input h-9 w-40"
            value={month}
            onChange={(e) => goMonth(e.target.value)}
          />
          {months.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {months.slice(0, 6).map((m) => (
                <button
                  key={m}
                  onClick={() => goMonth(m)}
                  className={`rounded-lg border px-2.5 py-1 text-xs transition ${
                    m === month ? "border-brand/50 bg-brand/15 text-brand-200" : "border-ink-700 bg-ink-800/50 text-ink-300 hover:bg-ink-700"
                  }`}
                >
                  {monthLabel(m)}
                </button>
              ))}
            </div>
          )}
        </div>
        <a href={`/api/dept/export?month=${month}`} className="btn btn-ghost btn-sm">
          <Download size={14} /> Выгрузить в CSV
        </a>
      </div>

      {/* Сводка месяца */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Доходы за месяц" value={incomeTotal} accent="text-emerald-300" />
        <Kpi label="Согласованные расходы" value={summary.approvedTotal} accent="text-ink-50" />
        <Kpi label="Сальдо (доходы − расходы)" value={balance} accent={balance >= 0 ? "text-emerald-300" : "text-red-300"} />
        <BudgetKpi month={month} planned={plannedBudget} left={budgetLeft} onSaved={() => router.refresh()} />
      </div>

      {/* Вкладки */}
      <div className="mb-4 flex rounded-xl border border-ink-700 bg-ink-800/50 p-0.5">
        <button
          onClick={() => setTab("expense")}
          className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition ${tab === "expense" ? "bg-brand text-ink-950" : "text-ink-300"}`}
        >
          Расходы ({expenses.length})
        </button>
        <button
          onClick={() => setTab("income")}
          className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition ${tab === "income" ? "bg-brand text-ink-950" : "text-ink-300"}`}
        >
          Доходы
        </button>
      </div>

      {tab === "expense" ? (
        <ExpensesTab month={month} expenses={expenses} summary={summary} onChanged={() => router.refresh()} />
      ) : (
        <IncomeTab month={month} incomes={incomes} total={incomeTotal} onChanged={() => router.refresh()} />
      )}
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-ink-400">{label}</div>
      <div className={`mt-1.5 font-display text-xl font-semibold ${accent}`}>{formatMoney(value)}</div>
    </div>
  );
}

// Планируемый бюджет — редактируется инлайн.
function BudgetKpi({ month, planned, left, onSaved }: { month: string; planned: number; left: number; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(planned));
  const [busy, setBusy] = useState(false);

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
    <div className="card !border-brand/25 p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-ink-400">Планируемый бюджет</div>
        <button className="text-ink-400 hover:text-brand" onClick={() => setEditing((v) => !v)} title="Изменить">
          <Pencil size={13} />
        </button>
      </div>
      {editing ? (
        <div className="mt-1.5 flex gap-1">
          <input className="input h-8 w-full" type="number" value={val} onChange={(e) => setVal(e.target.value)} autoFocus />
          <button className="btn btn-primary btn-sm" disabled={busy} onClick={save}>ОК</button>
        </div>
      ) : (
        <>
          <div className="mt-1.5 font-display text-xl font-semibold text-brand">{formatMoney(planned)}</div>
          <div className={`text-xs ${left >= 0 ? "text-ink-500" : "text-red-300"}`}>
            {left >= 0 ? `остаток ${formatMoney(left)}` : `перерасход ${formatMoney(-left)}`}
          </div>
        </>
      )}
    </div>
  );
}

// ── Реестр расходов ──────────────────────────────────────────────────────────
function ExpensesTab({
  month,
  expenses,
  summary,
  onChanged,
}: {
  month: string;
  expenses: ExpenseRow[];
  summary: ReturnType<typeof monthSummary>;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<ExpenseRow | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div>
      {/* Шапка-сводка месяца */}
      <div className="mb-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3 lg:grid-cols-6">
        <Sum label="Согласовано" value={summary.approvedTotal} />
        <Sum label="— с НДС" value={summary.withVatTotal} />
        <Sum label="— без НДС" value={summary.withoutVatTotal} />
        <Sum label="НДС итого" value={summary.vatTotal} />
        <Sum label="Не согласовано" value={summary.notApprovedTotal} warn />
        <Sum label="Потрачено" value={summary.spentTotal} />
      </div>
      <div className="mb-4 grid grid-cols-4 gap-2">
        {summary.weeks.map((w, i) => (
          <div key={i} className="rounded-lg border border-ink-800 bg-ink-900/50 px-3 py-2 text-center">
            <div className="text-[10px] uppercase text-ink-500">{i + 1} неделя</div>
            <div className="text-sm font-semibold text-ink-100">{formatMoney(w)}</div>
          </div>
        ))}
      </div>

      <div className="mb-3 flex justify-end">
        <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>+ Расход</button>
      </div>

      {expenses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink-700 py-10 text-center text-sm text-ink-400">
          Расходов за {monthLabel(month)} нет. Добавьте первый — «+ Расход».
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-ink-800 text-left text-xs uppercase tracking-wide text-ink-500">
                <th className="px-3 py-2 font-medium">Наименование</th>
                <th className="px-3 py-2 font-medium">Статья</th>
                <th className="px-3 py-2 text-right font-medium">Сумма</th>
                <th className="px-3 py-2 text-right font-medium">Без НДС / НДС</th>
                <th className="px-3 py-2 font-medium">Оплата → поставка</th>
                <th className="px-3 py-2 font-medium">Нед.</th>
                <th className="px-3 py-2 font-medium">Статус</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800">
              {expenses.map((e) => {
                const days = daysBetween(e.payDate, e.deliveryDate);
                const warn = needsJustification(e.payDate, e.deliveryDate) && !e.justification;
                return (
                  <tr key={e.id} className="hover:bg-ink-800/40">
                    <td className="px-3 py-2">
                      <div className="font-medium text-ink-100">{e.title}</div>
                      {e.legalEntity && <div className="text-xs text-ink-500">{e.legalEntity}</div>}
                    </td>
                    <td className="px-3 py-2 text-ink-300">{e.category ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-mono text-ink-100">
                      {formatMoney(e.amountTotal)}
                      <div className="text-[10px] text-ink-500">{e.vatRate === 22 ? "с НДС 22%" : "без НДС"}</div>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-ink-300">
                      {formatMoney(netOfExpense(e.amountTotal, e.vatRate))}
                      <div className="text-ink-500">НДС {formatMoney(vatOfExpense(e.amountTotal, e.vatRate))}</div>
                    </td>
                    <td className="px-3 py-2 text-xs text-ink-400">
                      {e.payDate ? new Date(e.payDate).toLocaleDateString("ru-RU") : "—"}
                      {" → "}
                      {e.deliveryDate ? new Date(e.deliveryDate).toLocaleDateString("ru-RU") : "—"}
                      {days != null && (
                        <span className={warn ? "text-amber-300" : "text-ink-500"}> ({days} дн.{warn ? " ⚠" : ""})</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center text-ink-300">{weekOfMonth(e.payDate) ?? "—"}</td>
                    <td className="px-3 py-2">
                      <span className={`badge ${e.status === "Не согласовано" ? "badge-muted" : "badge-brand"}`}>{e.status}</span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <button className="btn-icon h-8 w-8 text-ink-300 hover:text-brand" onClick={() => setEditing(e)} title="Изменить">
                          <Pencil size={13} />
                        </button>
                        <DeleteButton endpoint={`/api/dept/expenses/${e.id}`} what={`расход «${e.title}»`} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {(adding || editing) && (
        <ExpenseModal
          month={month}
          expense={editing}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSaved={onChanged}
        />
      )}
    </div>
  );
}

function Sum({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="rounded-lg border border-ink-800 bg-ink-900/50 px-3 py-2">
      <div className="text-[10px] uppercase text-ink-500">{label}</div>
      <div className={`text-sm font-semibold ${warn && value > 0 ? "text-amber-300" : "text-ink-100"}`}>{formatMoney(value)}</div>
    </div>
  );
}

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
    status: expense?.status ?? EXPENSE_STATUSES[0],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof f>(k: K, v: string) {
    setF((s) => ({ ...s, [k]: v }));
  }

  // Живой пересчёт для подсказки в форме.
  const amount = Number(f.amountTotal) || 0;
  const vatRate = Number(f.vatRate);
  const net = netOfExpense(amount, vatRate);
  const warnJust = needsJustification(f.payDate || null, f.deliveryDate || null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (warnJust && !f.justification.trim()) {
      setError("Оплата и поставка расходятся больше чем на 2 недели — заполните «Обоснование».");
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
    <Modal open onClose={onClose} title={expense ? "Изменить расход" : "Новый расход"} size="lg">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Наименование *</label>
          <input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} required autoFocus />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Статья</label>
            <select className="input" value={f.category} onChange={(e) => set("category", e.target.value)}>
              {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Юр.лицо</label>
            <input className="input" value={f.legalEntity} onChange={(e) => set("legalEntity", e.target.value)} placeholder="ИП … / уточняется" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Сумма ИТОГО ₽ *</label>
            <input className="input" type="number" value={f.amountTotal} onChange={(e) => set("amountTotal", e.target.value)} required />
          </div>
          <div>
            <label className="label">НДС</label>
            <select className="input" value={f.vatRate} onChange={(e) => set("vatRate", e.target.value)}>
              <option value="0">Нет</option>
              <option value="22">22 %</option>
            </select>
          </div>
          <div>
            <label className="label">Периодичность</label>
            <select className="input" value={f.periodicity} onChange={(e) => set("periodicity", e.target.value)}>
              {EXPENSE_PERIODICITY.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
        {amount > 0 && (
          <div className="rounded-lg bg-ink-900/60 px-3 py-2 text-xs text-ink-400">
            Без НДС ≈ <b className="text-ink-200">{formatMoney(net)}</b> · НДС {formatMoney(amount - net)}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Формат оплаты</label>
            <select className="input" value={f.payFormat} onChange={(e) => set("payFormat", e.target.value)}>
              {PAY_FORMATS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Дата оплаты</label>
            <input className="input" type="date" value={f.payDate} onChange={(e) => set("payDate", e.target.value)} />
          </div>
          <div>
            <label className="label">Дата поставки</label>
            <input className="input" type="date" value={f.deliveryDate} onChange={(e) => set("deliveryDate", e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">
            Обоснование {warnJust && <span className="text-amber-300">(обязательно — разрыв дат &gt; 2 недель)</span>}
          </label>
          <textarea className="input" value={f.justification} onChange={(e) => set("justification", e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Статус</label>
            <select className="input" value={f.status} onChange={(e) => set("status", e.target.value)}>
              {EXPENSE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Потрачено (факт) ₽</label>
            <input className="input" type="number" value={f.spentTotal} onChange={(e) => set("spentTotal", e.target.value)} />
          </div>
          <div>
            <label className="label">Дата закрытия актом</label>
            <input className="input" type="date" value={f.actClosedDate} onChange={(e) => set("actClosedDate", e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Описание</label>
          <textarea className="input" value={f.description} onChange={(e) => set("description", e.target.value)} />
        </div>
        <FormError message={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Отмена</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "…" : "Сохранить"}</button>
        </div>
      </form>
    </Modal>
  );
}

// ── Доходы ───────────────────────────────────────────────────────────────────
function IncomeTab({
  month,
  incomes,
  total,
  onChanged,
}: {
  month: string;
  incomes: Income[];
  total: number;
  onChanged: () => void;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm text-ink-400">Планируемые доходы за {monthLabel(month)}, по неделям</div>
        <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>+ Источник</button>
      </div>
      {incomes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink-700 py-10 text-center text-sm text-ink-400">
          Доходов за этот месяц нет. Добавьте источник — «+ Источник».
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-ink-800 text-left text-xs uppercase tracking-wide text-ink-500">
                <th className="px-4 py-2 font-medium">Источник</th>
                <th className="px-3 py-2 text-right font-medium">1 нед</th>
                <th className="px-3 py-2 text-right font-medium">2 нед</th>
                <th className="px-3 py-2 text-right font-medium">3 нед</th>
                <th className="px-3 py-2 text-right font-medium">4 нед</th>
                <th className="px-4 py-2 text-right font-medium">Итого</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800">
              {incomes.map((i) => (
                <IncomeRow key={i.id} income={i} onChanged={onChanged} />
              ))}
              <tr className="bg-ink-900/40 font-semibold">
                <td className="px-4 py-2 text-ink-200">Планируемые доходы</td>
                <td className="px-3 py-2 text-right text-ink-400">{formatMoney(incomes.reduce((s, i) => s + i.w1, 0))}</td>
                <td className="px-3 py-2 text-right text-ink-400">{formatMoney(incomes.reduce((s, i) => s + i.w2, 0))}</td>
                <td className="px-3 py-2 text-right text-ink-400">{formatMoney(incomes.reduce((s, i) => s + i.w3, 0))}</td>
                <td className="px-3 py-2 text-right text-ink-400">{formatMoney(incomes.reduce((s, i) => s + i.w4, 0))}</td>
                <td className="px-4 py-2 text-right text-brand">{formatMoney(total)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {adding && <IncomeModal month={month} onClose={() => setAdding(false)} onSaved={onChanged} />}
    </div>
  );
}

function IncomeRow({ income, onChanged }: { income: Income; onChanged: () => void }) {
  const total = income.w1 + income.w2 + income.w3 + income.w4;
  async function patchWeek(field: "w1" | "w2" | "w3" | "w4", value: number) {
    await apiFetch(`/api/dept/income/${income.id}`, { method: "PATCH", body: JSON.stringify({ [field]: value }) });
    onChanged();
  }
  return (
    <tr className="hover:bg-ink-800/40">
      <td className="px-4 py-2 font-medium text-ink-100">{income.source}</td>
      {(["w1", "w2", "w3", "w4"] as const).map((w) => (
        <td key={w} className="px-3 py-1.5 text-right">
          <input
            className="input h-8 w-24 text-right font-mono text-xs"
            type="number"
            defaultValue={income[w]}
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
    <Modal open onClose={onClose} title="Источник дохода" size="sm">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Источник</label>
          <select className="input" value={source} onChange={(e) => setSource(e.target.value)}>
            {INCOME_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            <option value="__custom__">➕ Свой источник…</option>
          </select>
          {source === "__custom__" && (
            <input className="input mt-2" placeholder="Название источника" value={custom} onChange={(e) => setCustom(e.target.value)} autoFocus />
          )}
        </div>
        <p className="text-xs text-ink-500">Суммы по неделям впишете в таблице после добавления.</p>
        <FormError message={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Отмена</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "…" : "Добавить"}</button>
        </div>
      </form>
    </Modal>
  );
}
