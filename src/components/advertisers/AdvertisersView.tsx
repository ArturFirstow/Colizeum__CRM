"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Modal, FormError } from "@/components/ui/Modal";
import { TypeBadge } from "@/components/ui/primitives";
import { apiFetch } from "@/lib/client";
import { ADVERTISER_TYPES } from "@/lib/enums";

type Advertiser = {
  id: string;
  nameRu: string;
  nameEn: string | null;
  legalEntity: string | null;
  inn: string | null;
  type: string;
  status: string;
  notes: string | null;
  archived: boolean;
  _count: { deals: number; documents: number; contacts: number };
};

export function AdvertisersView({ initial }: { initial: Advertiser[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [showArchive, setShowArchive] = useState(false);
  const [open, setOpen] = useState(false);

  const archivedCount = useMemo(() => initial.filter((a) => a.archived).length, [initial]);

  // Архивные карточки не показываются в основном списке, но доступны
  // через поиск и раздел «Архив» (v2, п.1.2).
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return initial.filter((a) => {
      if (!query && a.archived !== showArchive) return false;
      if (typeFilter && a.type !== typeFilter) return false;
      if (!query) return true;
      return [a.nameRu, a.nameEn, a.legalEntity, a.inn]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(query));
    });
  }, [initial, q, typeFilter, showArchive]);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-ink-700 bg-ink-800/60 text-xl">
            ☰
          </div>
          <div>
            <h1 className="text-2xl font-bold text-ink-50">Клиенты</h1>
            <p className="mt-0.5 text-sm text-ink-300">
              Карточка заводится при первом касании. Подрядчиков не вносим.
            </p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setOpen(true)}>
          + Рекламодатель
        </button>
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <input
          className="input sm:max-w-xs"
          placeholder="Поиск: название, юрлицо, ИНН…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <FilterChip active={typeFilter === ""} onClick={() => setTypeFilter("")}>
            Все
          </FilterChip>
          {ADVERTISER_TYPES.map((t) => (
            <FilterChip key={t} active={typeFilter === t} onClick={() => setTypeFilter(t)}>
              {t}
            </FilterChip>
          ))}
          <FilterChip active={showArchive} onClick={() => setShowArchive((v) => !v)}>
            🗄 Архив ({archivedCount})
          </FilterChip>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-700 bg-ink-900/40 px-6 py-14 text-center text-ink-400">
          Ничего не найдено
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a) => (
            <Link key={a.id} href={`/advertisers/${a.id}`} className="card card-hover p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-base font-bold text-ink-50">{a.nameRu}</span>
                    {a.archived && <span className="badge badge-muted shrink-0">архив</span>}
                  </div>
                  {a.legalEntity && (
                    <div className="mt-0.5 truncate text-xs text-ink-400">{a.legalEntity}</div>
                  )}
                </div>
                <TypeBadge type={a.type} />
              </div>
              {/* На «лицевой» стороне — только суть; детали раскрываются в карточке по клику. */}
              <div className="mt-4 flex items-center gap-4 border-t border-ink-800 pt-3 text-xs text-ink-400">
                <span>⑂ {a._count.deals} сделок</span>
                <span>❐ {a._count.documents} док.</span>
                <span>☎ {a._count.contacts}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <NewAdvertiserModal open={open} onClose={() => setOpen(false)} onCreated={() => router.refresh()} />
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "border-brand/50 bg-brand/15 text-brand-200"
          : "border-ink-700 bg-ink-800/50 text-ink-300 hover:bg-ink-700"
      }`}
    >
      {children}
    </button>
  );
}

function NewAdvertiserModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    nameRu: "",
    legalEntity: "",
    inn: "",
    type: "Рекламодатель",
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiFetch("/api/advertisers", { method: "POST", body: JSON.stringify(form) });
      onCreated();
      onClose();
      setForm({ nameRu: "", legalEntity: "", inn: "", type: "Рекламодатель", notes: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Новый рекламодатель" subtitle="Карточка CRM">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Название (бренд) *</label>
          <input className="input" value={form.nameRu} onChange={(e) => set("nameRu", e.target.value)} required autoFocus />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Юрлицо</label>
            <input className="input" value={form.legalEntity} onChange={(e) => set("legalEntity", e.target.value)} placeholder="АО «…»" />
          </div>
          <div>
            <label className="label">ИНН</label>
            <input className="input" value={form.inn} onChange={(e) => set("inn", e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Тип</label>
          <select className="input" value={form.type} onChange={(e) => set("type", e.target.value)}>
            {ADVERTISER_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Заметки</label>
          <textarea className="input" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>
        <FormError message={error} />
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Сохранение…" : "Создать"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
