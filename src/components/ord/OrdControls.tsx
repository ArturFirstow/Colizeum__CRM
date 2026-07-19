"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Modal, FormError } from "@/components/ui/Modal";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { apiFetch } from "@/lib/client";
import { ORD_ROLES } from "@/lib/enums";

type Deal = { id: string; title: string; advertiserName?: string };

export function NewOrdButton({ deals }: { deals: Deal[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({
    dealId: "",
    role: "Агентство",
    erid: "",
    finalClient: "",
    platform: "",
    urgent: false,
    monthlyClosing: true,
  });

  function set<K extends keyof typeof f>(k: K, v: (typeof f)[K]) {
    setF((s) => ({ ...s, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiFetch("/api/ord", {
        method: "POST",
        body: JSON.stringify({
          dealId: f.dealId,
          role: f.role,
          erid: f.erid || undefined,
          finalClient: f.finalClient || undefined,
          platform: f.platform || undefined,
          urgent: f.urgent,
          monthlyClosing: f.monthlyClosing,
        }),
      });
      setOpen(false);
      setF({ dealId: "", role: "Агентство", erid: "", finalClient: "", platform: "", urgent: false, monthlyClosing: true });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        + ЕРИД
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Новая маркировка ЕРИД">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Сделка *</label>
            <select className="input" value={f.dealId} onChange={(e) => set("dealId", e.target.value)} required>
              <option value="">— выбрать —</option>
              {deals.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                  {d.advertiserName ? ` · ${d.advertiserName}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Роль</label>
              <select className="input" value={f.role} onChange={(e) => set("role", e.target.value)}>
                {ORD_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">ЕРИД</label>
              <input className="input" value={f.erid} onChange={(e) => set("erid", e.target.value)} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Конечный заказчик</label>
              <input className="input" value={f.finalClient} onChange={(e) => set("finalClient", e.target.value)} />
            </div>
            <div>
              <label className="label">Площадка</label>
              <input className="input" value={f.platform} onChange={(e) => set("platform", e.target.value)} placeholder="соцсети / моб.приложение" />
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-ink-200">
              <input type="checkbox" className="h-4 w-4 accent-brand" checked={f.monthlyClosing} onChange={(e) => set("monthlyClosing", e.target.checked)} />
              Акты ежемесячно
            </label>
            <label className="flex items-center gap-2 text-sm text-ink-200">
              <input type="checkbox" className="h-4 w-4 accent-brand" checked={f.urgent} onChange={(e) => set("urgent", e.target.checked)} />
              🔴 Срочно снять/сдать акт
            </label>
          </div>
          <FormError message={error} />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "…" : "Добавить"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

type OrdRow = {
  id: string;
  urgent: boolean;
  erid: string | null;
  role: string;
  finalClient: string | null;
  platform: string | null;
  monthlyClosing: boolean;
  creativeFileName: string | null;
  actFileName: string | null;
};

// ЕРИД вводится прямо в строке реестра: вписал → Enter или клик мимо — сохранено.
export function EridInline({ ord }: { ord: { id: string; erid: string | null } }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function save(value: string) {
    const v = value.trim();
    if (v === (ord.erid ?? "")) return;
    setBusy(true);
    try {
      await apiFetch(`/api/ord/${ord.id}`, { method: "PATCH", body: JSON.stringify({ erid: v }) });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <input
      className="input h-8 w-40 font-mono text-xs"
      defaultValue={ord.erid ?? ""}
      placeholder="вписать ЕРИД…"
      disabled={busy}
      onBlur={(e) => save(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

// Редактирование карточки ОРД целиком (роль, заказчик, площадка, акты).
export function EditOrdButton({ ord }: { ord: OrdRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({
    role: ord.role,
    erid: ord.erid ?? "",
    finalClient: ord.finalClient ?? "",
    platform: ord.platform ?? "",
    monthlyClosing: ord.monthlyClosing,
    urgent: ord.urgent,
  });

  function set<K extends keyof typeof f>(k: K, v: (typeof f)[K]) {
    setF((s) => ({ ...s, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiFetch(`/api/ord/${ord.id}`, { method: "PATCH", body: JSON.stringify(f) });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Редактировать карточку"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-ink-700 bg-ink-800/60 text-ink-300 hover:border-brand/40 hover:text-brand"
      >
        <Pencil size={14} strokeWidth={2.2} />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Карточка ОРД">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Роль</label>
              <select className="input" value={f.role} onChange={(e) => set("role", e.target.value)}>
                {ORD_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">ЕРИД</label>
              <input className="input font-mono" value={f.erid} onChange={(e) => set("erid", e.target.value)} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Конечный заказчик</label>
              <input className="input" value={f.finalClient} onChange={(e) => set("finalClient", e.target.value)} />
            </div>
            <div>
              <label className="label">Площадка</label>
              <input className="input" value={f.platform} onChange={(e) => set("platform", e.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-ink-200">
              <input type="checkbox" className="h-4 w-4 accent-brand" checked={f.monthlyClosing} onChange={(e) => set("monthlyClosing", e.target.checked)} />
              Акты ежемесячно
            </label>
            <label className="flex items-center gap-2 text-sm text-ink-200">
              <input type="checkbox" className="h-4 w-4 accent-brand" checked={f.urgent} onChange={(e) => set("urgent", e.target.checked)} />
              🔴 Срочно
            </label>
          </div>
          <FormError message={error} />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "…" : "Сохранить"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function OrdRowActions({ ord }: { ord: OrdRow }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const creativeRef = useRef<HTMLInputElement>(null);
  const actRef = useRef<HTMLInputElement>(null);

  async function toggleUrgent() {
    setBusy(true);
    try {
      await apiFetch(`/api/ord/${ord.id}`, { method: "PATCH", body: JSON.stringify({ urgent: !ord.urgent }) });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function upload(kind: "creative" | "act", file: File) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("kind", kind);
      fd.append("file", file);
      await apiFetch(`/api/ord/${ord.id}/files`, { method: "POST", body: fd });
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      <button
        onClick={toggleUrgent}
        disabled={busy}
        title={ord.urgent ? "Снять флаг срочности" : "Пометить срочным"}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border text-sm transition ${
          ord.urgent
            ? "border-red-500/40 bg-red-500/15 text-red-300"
            : "border-ink-700 bg-ink-800/60 text-ink-400 hover:text-red-300"
        }`}
      >
        🔴
      </button>

      {/* Креатив (картинка) */}
      <input ref={creativeRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload("creative", e.target.files[0])} />
      {ord.creativeFileName ? (
        <a href={`/api/ord/${ord.id}/file/creative`} title={`Креатив: ${ord.creativeFileName}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-ink-700 bg-ink-800/60 text-sm hover:bg-ink-700">
          🖼
        </a>
      ) : (
        <button onClick={() => creativeRef.current?.click()} disabled={busy} title="Загрузить креатив" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-dashed border-ink-700 text-ink-500 hover:text-ink-200">
          🖼
        </button>
      )}

      {/* Акт (PDF) */}
      <input ref={actRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && upload("act", e.target.files[0])} />
      {ord.actFileName ? (
        <a href={`/api/ord/${ord.id}/file/act`} title={`Акт: ${ord.actFileName}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-ink-700 bg-ink-800/60 text-sm hover:bg-ink-700">
          📄
        </a>
      ) : (
        <button onClick={() => actRef.current?.click()} disabled={busy} title="Загрузить PDF акта" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-dashed border-ink-700 text-ink-500 hover:text-ink-200">
          📄
        </button>
      )}

      <DeleteButton endpoint={`/api/ord/${ord.id}`} what="запись ОРД" />
    </div>
  );
}
