"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, FormError } from "@/components/ui/Modal";
import { apiFetch } from "@/lib/client";

export function AddContactButton({ advertiserId }: { advertiserId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ fio: "", role: "", email: "", phone: "", telegram: "", isPrimary: false });

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiFetch(`/api/advertisers/${advertiserId}/contacts`, {
        method: "POST",
        body: JSON.stringify(form),
      });
      setOpen(false);
      setForm({ fio: "", role: "", email: "", phone: "", telegram: "", isPrimary: false });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
        + Контакт
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Новый контакт" size="sm">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">ФИО *</label>
            <input className="input" value={form.fio} onChange={(e) => set("fio", e.target.value)} required autoFocus />
          </div>
          <div>
            <label className="label">Роль</label>
            <input className="input" value={form.role} onChange={(e) => set("role", e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Telegram</label>
              <input className="input" value={form.telegram} onChange={(e) => set("telegram", e.target.value)} placeholder="@…" />
            </div>
            <div>
              <label className="label">Телефон</label>
              <input className="input" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">E-mail</label>
            <input className="input" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-200">
            <input
              type="checkbox"
              checked={form.isPrimary}
              onChange={(e) => set("isPrimary", e.target.checked)}
              className="h-4 w-4 accent-brand"
            />
            Основной контакт
          </label>
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
