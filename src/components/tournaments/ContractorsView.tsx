"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, FormError } from "@/components/ui/Modal";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { Ring } from "@/components/ui/primitives";
import { apiFetch } from "@/lib/client";
import { contractorStatusStyle } from "@/lib/ui-tokens";
import { TOURNAMENT_CONTRACTOR_STATUSES } from "@/lib/enums";

type Contractor = {
  id: string;
  name: string;
  brand: string | null;
  contactPerson: string | null;
  contact: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { tournaments: number };
};

const EMPTY = { name: "", brand: "", contactPerson: "", contact: "", status: "Лид", notes: "" };

export function ContractorsView({ contractors }: { contractors: Contractor[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Contractor | null>(null);
  const [filter, setFilter] = useState<string>("Все");

  // Мини-воронка: сколько контрагентов на каждом статусе.
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of contractors) map[c.status] = (map[c.status] ?? 0) + 1;
    return map;
  }, [contractors]);

  const shown = filter === "Все" ? contractors : contractors.filter((c) => c.status === filter);

  return (
    <div>
      {/* Воронка-фильтр по статусам */}
      <div className="mb-4 flex flex-wrap gap-2">
        <FilterChip label={`Все · ${contractors.length}`} active={filter === "Все"} onClick={() => setFilter("Все")} />
        {TOURNAMENT_CONTRACTOR_STATUSES.map((s) => (
          <FilterChip
            key={s}
            label={`${s} · ${counts[s] ?? 0}`}
            active={filter === s}
            styleClass={contractorStatusStyle(s)}
            onClick={() => setFilter(s)}
          />
        ))}
        <button className="btn btn-primary btn-sm ml-auto" onClick={() => setOpen(true)}>
          + Контрагент
        </button>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-700 bg-ink-900/40 px-6 py-14 text-center text-ink-400">
          Пока нет контрагентов{filter !== "Все" ? " в этом статусе" : ""}. Добавьте первого — кнопка «+ Контрагент».
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((c) => (
            <div key={c.id} className="card card-hover p-4">
              <div className="flex items-start justify-between gap-2">
                <button className="min-w-0 text-left" onClick={() => setEdit(c)}>
                  <div className="truncate font-semibold text-ink-50">{c.name}</div>
                  {c.brand && <div className="truncate text-xs text-ink-400">Бренд: {c.brand}</div>}
                </button>
                <Ring className={contractorStatusStyle(c.status)}>{c.status}</Ring>
              </div>
              <div className="mt-3 space-y-0.5 border-t border-ink-800 pt-2 text-xs text-ink-400">
                {c.contactPerson && <div>👤 {c.contactPerson}</div>}
                {c.contact && <div>✉ {c.contact}</div>}
                <div>♛ турниров: {c._count.tournaments}</div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <button className="text-xs font-medium text-brand hover:underline" onClick={() => setEdit(c)}>
                  Открыть
                </button>
                <DeleteButton endpoint={`/api/tournaments/contractors/${c.id}`} what={`контрагента «${c.name}»`} />
              </div>
            </div>
          ))}
        </div>
      )}

      <ContractorModal open={open} onClose={() => setOpen(false)} onSaved={() => router.refresh()} />
      {edit && (
        <ContractorModal
          open
          contractor={edit}
          onClose={() => setEdit(null)}
          onSaved={() => router.refresh()}
        />
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  styleClass,
  onClick,
}: {
  label: string;
  active: boolean;
  styleClass?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`pill ring-1 ring-inset transition ${
        active ? styleClass ?? "bg-brand/20 text-brand-200 ring-brand/40" : "bg-ink-800/60 text-ink-300 ring-ink-700 hover:bg-ink-800"
      }`}
    >
      {label}
    </button>
  );
}

function ContractorModal({
  open,
  contractor,
  onClose,
  onSaved,
}: {
  open: boolean;
  contractor?: Contractor;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = !!contractor;
  const [f, setF] = useState(
    contractor
      ? {
          name: contractor.name,
          brand: contractor.brand ?? "",
          contactPerson: contractor.contactPerson ?? "",
          contact: contractor.contact ?? "",
          status: contractor.status,
          notes: contractor.notes ?? "",
        }
      : { ...EMPTY },
  );
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
      if (editing) {
        await apiFetch(`/api/tournaments/contractors/${contractor!.id}`, { method: "PATCH", body: JSON.stringify(f) });
      } else {
        await apiFetch("/api/tournaments/contractors", { method: "POST", body: JSON.stringify(f) });
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
    <Modal open={open} onClose={onClose} title={editing ? "Контрагент" : "Новый контрагент"} size="lg">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Заказчик *</label>
            <input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} required autoFocus placeholder="напр. Ситилинк" />
          </div>
          <div>
            <label className="label">Бренд</label>
            <input className="input" value={f.brand} onChange={(e) => set("brand", e.target.value)} placeholder="если отличается" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Контактное лицо</label>
            <input className="input" value={f.contactPerson} onChange={(e) => set("contactPerson", e.target.value)} />
          </div>
          <div>
            <label className="label">Связь (телефон / почта / телеграм)</label>
            <input className="input" value={f.contact} onChange={(e) => set("contact", e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Статус</label>
          <select className="input" value={f.status} onChange={(e) => set("status", e.target.value)}>
            {TOURNAMENT_CONTRACTOR_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Заметки</label>
          <textarea className="input min-h-[80px]" value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="условия, договорённости, детали" />
        </div>
        <FormError message={error} />
        <div className="flex items-center justify-between gap-2">
          {editing ? (
            <DeleteButton endpoint={`/api/tournaments/contractors/${contractor!.id}`} what={`контрагента «${contractor!.name}»`} variant="button" />
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "…" : editing ? "Сохранить" : "Создать"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
