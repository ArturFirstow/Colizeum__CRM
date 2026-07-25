"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Modal, FormError } from "@/components/ui/Modal";
import { Ring } from "@/components/ui/primitives";
import { apiFetch } from "@/lib/client";
import { formatMoney, formatDate } from "@/lib/format";
import { tournamentStatusStyle } from "@/lib/ui-tokens";
import { TOURNAMENT_DISCIPLINES, TOURNAMENT_FORMATS, TOURNAMENT_STATUSES } from "@/lib/enums";

type Row = {
  id: string;
  title: string;
  discipline: string | null;
  format: string | null;
  arena: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  contractor: { id: string; name: string } | null;
  clientLabel: string | null;
  budgetPlanned: number;
  budgetActual: number;
  lineCount: number;
};
type Contractor = { id: string; name: string };

export function TournamentsView({ tournaments, contractors }: { tournaments: Row[]; contractors: Contractor[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-sm text-ink-400">Всего турниров: {tournaments.length}</div>
        <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}>
          + Турнир
        </button>
      </div>

      {tournaments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-700 bg-ink-900/40 px-6 py-14 text-center text-ink-400">
          Пока нет турниров. Создайте первый — кнопка «+ Турнир». Внутри карточки соберёте смету.
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {tournaments.map((t) => {
            const client = t.contractor?.name ?? t.clientLabel;
            return (
              <Link key={t.id} href={`/tournaments/${t.id}`} className="card card-hover block p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-ink-50">{t.title}</div>
                    {client && <div className="mt-0.5 truncate text-xs text-ink-400">Заказчик: {client}</div>}
                  </div>
                  <Ring className={tournamentStatusStyle(t.status)}>{t.status}</Ring>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {t.discipline && <span className="pill bg-ink-800 text-ink-200 ring-1 ring-inset ring-ink-700">{t.discipline}</span>}
                  {t.format && <span className="pill bg-ink-800 text-ink-200 ring-1 ring-inset ring-ink-700">{t.format}</span>}
                  {t.arena && <span className="pill bg-ink-800 text-ink-200 ring-1 ring-inset ring-ink-700">📍 {t.arena}</span>}
                </div>
                <div className="mt-3 flex items-end justify-between border-t border-ink-800 pt-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-ink-500">Смета (план)</div>
                    <div className="font-display text-xl font-semibold text-brand">{formatMoney(t.budgetPlanned)}</div>
                    <div className="text-[11px] text-ink-500">{t.lineCount} статей{t.budgetActual > 0 ? ` · факт ${formatMoney(t.budgetActual)}` : ""}</div>
                  </div>
                  <div className="text-right text-xs text-ink-400">
                    {t.startDate ? formatDate(t.startDate) : "даты не заданы"}
                    {t.endDate && t.endDate !== t.startDate ? ` — ${formatDate(t.endDate)}` : ""}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <TournamentModal open={open} onClose={() => setOpen(false)} contractors={contractors} onSaved={() => router.refresh()} />
    </div>
  );
}

function TournamentModal({
  open,
  onClose,
  contractors,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  contractors: Contractor[];
  onSaved: () => void;
}) {
  const router = useRouter();
  const [f, setF] = useState({
    title: "",
    contractorId: "",
    clientLabel: "",
    discipline: "",
    format: "Гибрид",
    arena: "Colizeum Шелепиха",
    startDate: "",
    endDate: "",
    status: "Планируется",
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
      const created = await apiFetch<{ id: string }>("/api/tournaments", {
        method: "POST",
        body: JSON.stringify({
          title: f.title,
          contractorId: f.contractorId || undefined,
          clientLabel: f.clientLabel || undefined,
          discipline: f.discipline || undefined,
          format: f.format || undefined,
          arena: f.arena || undefined,
          startDate: f.startDate || undefined,
          endDate: f.endDate || undefined,
          status: f.status,
        }),
      });
      onClose();
      onSaved();
      // Сразу открываем карточку — там собирают смету.
      router.push(`/tournaments/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Новый турнир" size="lg">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Название турнира *</label>
          <input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} required autoFocus placeholder="напр. Кубок бренда по CS2" />
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
            <input className="input" value={f.clientLabel} onChange={(e) => set("clientLabel", e.target.value)} placeholder="если нет карточки" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Дисциплина</label>
            <input className="input" list="disciplines" value={f.discipline} onChange={(e) => set("discipline", e.target.value)} placeholder="CS2" />
            <datalist id="disciplines">
              {TOURNAMENT_DISCIPLINES.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="label">Формат</label>
            <select className="input" value={f.format} onChange={(e) => set("format", e.target.value)}>
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
        <FormError message={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "…" : "Создать и открыть смету"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
