"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Modal, FormError } from "@/components/ui/Modal";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { Ring, Field } from "@/components/ui/primitives";
import { apiFetch } from "@/lib/client";
import { formatMoney, formatDate } from "@/lib/format";
import { tournamentStatusStyle } from "@/lib/ui-tokens";
import {
  TOURNAMENT_BUDGET_LINES,
  TOURNAMENT_DISCIPLINES,
  TOURNAMENT_FORMATS,
  TOURNAMENT_STATUSES,
} from "@/lib/enums";

type Tournament = {
  id: string;
  title: string;
  contractorId: string | null;
  contractor: { id: string; name: string } | null;
  clientLabel: string | null;
  discipline: string | null;
  format: string | null;
  arena: string | null;
  status: string;
  budgetNote: string | null;
  startDate: string | null;
  endDate: string | null;
};
type Line = {
  id: string;
  category: string;
  title: string | null;
  amountPlanned: number;
  amountActual: number | null;
  notes: string | null;
};
type Contractor = { id: string; name: string };

export function TournamentDetail({
  tournament,
  lines,
  contractors,
}: {
  tournament: Tournament;
  lines: Line[];
  contractors: Contractor[];
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);

  const totals = useMemo(() => {
    const planned = lines.reduce((s, l) => s + l.amountPlanned, 0);
    const actual = lines.reduce((s, l) => s + (l.amountActual ?? 0), 0);
    return { planned, actual, diff: actual - planned };
  }, [lines]);

  const client = tournament.contractor?.name ?? tournament.clientLabel;
  const usedCategories = new Set(lines.map((l) => l.category));
  const templateLeft = TOURNAMENT_BUDGET_LINES.filter((c) => !usedCategories.has(c));

  async function addLine(category: string, amountPlanned = 0) {
    await apiFetch(`/api/tournaments/${tournament.id}/budget`, {
      method: "POST",
      body: JSON.stringify({ category, amountPlanned, sort: lines.length }),
    });
    router.refresh();
  }

  async function addAllTemplate() {
    for (let i = 0; i < templateLeft.length; i++) {
      await apiFetch(`/api/tournaments/${tournament.id}/budget`, {
        method: "POST",
        body: JSON.stringify({ category: templateLeft[i], amountPlanned: 0, sort: lines.length + i }),
      });
    }
    router.refresh();
  }

  return (
    <div>
      {/* Шапка */}
      <div className="mb-5">
        <Link href="/tournaments" className="text-xs text-ink-400 hover:text-ink-200">
          ← к списку турниров
        </Link>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-2xl font-semibold uppercase tracking-wide text-ink-50">{tournament.title}</h1>
              <Ring className={tournamentStatusStyle(tournament.status)}>{tournament.status}</Ring>
            </div>
            {client && <p className="mt-1 text-sm text-ink-300">Заказчик: {client}</p>}
          </div>
          <div className="flex gap-2">
            <button className="btn btn-ghost btn-sm" onClick={() => setEditOpen(true)}>
              Редактировать
            </button>
            <DeleteButton endpoint={`/api/tournaments/${tournament.id}`} what={`турнир «${tournament.title}»`} redirectTo="/tournaments" variant="button" />
          </div>
        </div>
      </div>

      {/* Мета */}
      <div className="card mb-5 grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
        <Field label="Дисциплина">{tournament.discipline ?? "—"}</Field>
        <Field label="Формат">{tournament.format ?? "—"}</Field>
        <Field label="Площадка">{tournament.arena ?? "—"}</Field>
        <Field label="Даты">
          {tournament.startDate ? formatDate(tournament.startDate) : "—"}
          {tournament.endDate && tournament.endDate !== tournament.startDate ? ` — ${formatDate(tournament.endDate)}` : ""}
        </Field>
      </div>

      {/* Смета */}
      <section className="card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-ink-50">Смета турнира</h2>
            <p className="mt-0.5 text-xs text-ink-500">Предполагаемый бюджет — план по статьям, факт для сверки</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {templateLeft.length > 0 && lines.length === 0 && (
              <button className="btn btn-ghost btn-sm" onClick={addAllTemplate}>
                Заполнить по шаблону
              </button>
            )}
          </div>
        </div>

        {/* Итоги */}
        <div className="mb-4 grid grid-cols-3 gap-3">
          <SumTile label="План" value={formatMoney(totals.planned)} accent />
          <SumTile label="Факт" value={formatMoney(totals.actual)} />
          <SumTile
            label={totals.diff > 0 ? "Перерасход" : "Экономия"}
            value={formatMoney(Math.abs(totals.diff))}
            danger={totals.diff > 0}
          />
        </div>

        {lines.length === 0 ? (
          <div className="rounded-xl border border-dashed border-ink-700 bg-ink-900/40 px-5 py-8 text-center text-sm text-ink-400">
            Смета пустая. Добавьте статьи ниже или нажмите «Заполнить по шаблону».
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-left text-[11px] uppercase tracking-wide text-ink-500">
                  <th className="py-2 pr-3 font-medium">Статья</th>
                  <th className="py-2 pr-3 font-medium">Уточнение</th>
                  <th className="py-2 pr-3 text-right font-medium">План</th>
                  <th className="py-2 pr-3 text-right font-medium">Факт</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <BudgetRow key={l.id} line={l} onChanged={() => router.refresh()} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Быстрое добавление статей из шаблона */}
        {templateLeft.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ink-800 pt-4">
            <span className="text-xs text-ink-500">Добавить статью:</span>
            {templateLeft.map((c) => (
              <button key={c} className="pill bg-ink-800/60 text-ink-200 ring-1 ring-inset ring-ink-700 transition hover:bg-ink-800" onClick={() => addLine(c)}>
                + {c}
              </button>
            ))}
          </div>
        )}

        {/* Своя статья */}
        <CustomLineForm tournamentId={tournament.id} sort={lines.length} onAdded={() => router.refresh()} />

        {tournament.budgetNote && (
          <p className="mt-4 rounded-lg bg-ink-800/40 px-3 py-2 text-xs text-ink-300">{tournament.budgetNote}</p>
        )}
      </section>

      {editOpen && (
        <EditTournamentModal tournament={tournament} contractors={contractors} onClose={() => setEditOpen(false)} onSaved={() => router.refresh()} />
      )}
    </div>
  );
}

function SumTile({ label, value, accent, danger }: { label: string; value: string; accent?: boolean; danger?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${danger ? "border-red-500/30 bg-red-500/[0.06]" : accent ? "border-brand/30 bg-brand/[0.06]" : "border-ink-700 bg-ink-800/40"}`}>
      <div className="text-[11px] uppercase tracking-wide text-ink-400">{label}</div>
      <div className={`mt-1 font-display text-xl font-semibold ${danger ? "text-red-300" : accent ? "text-brand" : "text-ink-50"}`}>{value}</div>
    </div>
  );
}

// Строка сметы: план/факт редактируются инлайн (сохранение по потере фокуса).
function BudgetRow({ line, onChanged }: { line: Line; onChanged: () => void }) {
  const [planned, setPlanned] = useState(String(line.amountPlanned || ""));
  const [actual, setActual] = useState(line.amountActual != null ? String(line.amountActual) : "");
  const [title, setTitle] = useState(line.title ?? "");

  async function patch(body: Record<string, unknown>) {
    await apiFetch(`/api/tournaments/budget/${line.id}`, { method: "PATCH", body: JSON.stringify(body) });
    onChanged();
  }

  return (
    <tr className="border-b border-ink-800/60">
      <td className="py-2 pr-3 font-medium text-ink-100">{line.category}</td>
      <td className="py-2 pr-3">
        <input
          className="input h-8 px-2 py-1 text-xs"
          value={title}
          placeholder="—"
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title !== (line.title ?? "") && patch({ title })}
        />
      </td>
      <td className="py-2 pr-3 text-right">
        <input
          className="input h-8 w-28 px-2 py-1 text-right text-xs"
          inputMode="numeric"
          value={planned}
          onChange={(e) => setPlanned(e.target.value.replace(/[^\d]/g, ""))}
          onBlur={() => patch({ amountPlanned: Number(planned) || 0 })}
        />
      </td>
      <td className="py-2 pr-3 text-right">
        <input
          className="input h-8 w-28 px-2 py-1 text-right text-xs"
          inputMode="numeric"
          value={actual}
          placeholder="—"
          onChange={(e) => setActual(e.target.value.replace(/[^\d]/g, ""))}
          onBlur={() => patch({ amountActual: actual === "" ? undefined : Number(actual) || 0 })}
        />
      </td>
      <td className="py-2 text-right">
        <DeleteButton endpoint={`/api/tournaments/budget/${line.id}`} what={`статью «${line.category}»`} />
      </td>
    </tr>
  );
}

function CustomLineForm({ tournamentId, sort, onAdded }: { tournamentId: string; sort: number; onAdded: () => void }) {
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!category.trim()) return;
    setBusy(true);
    try {
      await apiFetch(`/api/tournaments/${tournamentId}/budget`, {
        method: "POST",
        body: JSON.stringify({ category: category.trim(), amountPlanned: Number(amount) || 0, sort }),
      });
      setCategory("");
      setAmount("");
      onAdded();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={add} className="mt-3 flex flex-wrap items-end gap-2 border-t border-ink-800 pt-4">
      <div className="min-w-[180px] flex-1">
        <label className="label">Своя статья</label>
        <input className="input h-9" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="напр. Хостинг серверов" />
      </div>
      <div className="w-32">
        <label className="label">План, ₽</label>
        <input className="input h-9 text-right" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} placeholder="0" />
      </div>
      <button type="submit" className="btn btn-ghost btn-sm" disabled={busy}>
        + Добавить
      </button>
    </form>
  );
}

function EditTournamentModal({
  tournament,
  contractors,
  onClose,
  onSaved,
}: {
  tournament: Tournament;
  contractors: Contractor[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState({
    title: tournament.title,
    contractorId: tournament.contractorId ?? "",
    clientLabel: tournament.clientLabel ?? "",
    discipline: tournament.discipline ?? "",
    format: tournament.format ?? "",
    arena: tournament.arena ?? "",
    status: tournament.status,
    startDate: tournament.startDate ? tournament.startDate.slice(0, 10) : "",
    endDate: tournament.endDate ? tournament.endDate.slice(0, 10) : "",
    budgetNote: tournament.budgetNote ?? "",
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
      await apiFetch(`/api/tournaments/${tournament.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: f.title,
          contractorId: f.contractorId,
          clientLabel: f.clientLabel,
          discipline: f.discipline,
          format: f.format || undefined,
          arena: f.arena,
          status: f.status,
          startDate: f.startDate,
          endDate: f.endDate,
          budgetNote: f.budgetNote,
        }),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Редактировать турнир" size="lg">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Название *</label>
          <input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} required />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Заказчик (из базы)</label>
            <select className="input" value={f.contractorId} onChange={(e) => set("contractorId", e.target.value)}>
              <option value="">— нет —</option>
              {contractors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">…или заказчик текстом</label>
            <input className="input" value={f.clientLabel} onChange={(e) => set("clientLabel", e.target.value)} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Дисциплина</label>
            <input className="input" list="disc-edit" value={f.discipline} onChange={(e) => set("discipline", e.target.value)} />
            <datalist id="disc-edit">
              {TOURNAMENT_DISCIPLINES.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="label">Формат</label>
            <select className="input" value={f.format} onChange={(e) => set("format", e.target.value)}>
              <option value="">—</option>
              {TOURNAMENT_FORMATS.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Статус</label>
            <select className="input" value={f.status} onChange={(e) => set("status", e.target.value)}>
              {TOURNAMENT_STATUSES.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Площадка</label>
            <input className="input" value={f.arena} onChange={(e) => set("arena", e.target.value)} />
          </div>
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
          <label className="label">Комментарий к смете</label>
          <textarea className="input min-h-[70px]" value={f.budgetNote} onChange={(e) => set("budgetNote", e.target.value)} />
        </div>
        <FormError message={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "…" : "Сохранить"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
