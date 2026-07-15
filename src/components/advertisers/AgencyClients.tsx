"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, FormError } from "@/components/ui/Modal";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { apiFetch } from "@/lib/client";

type Client = {
  id: string;
  name: string;
  brand: string | null;
  inn: string | null;
  notes: string | null;
};

// Список клиентов агентства с добавлением/удалением.
export function AgencyClients({
  advertiserId,
  clients,
}: {
  advertiserId: string;
  clients: Client[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({ name: "", brand: "", inn: "", notes: "" });

  function set<K extends keyof typeof f>(k: K, v: string) {
    setF((s) => ({ ...s, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiFetch(`/api/advertisers/${advertiserId}/clients`, {
        method: "POST",
        body: JSON.stringify(f),
      });
      setOpen(false);
      setF({ name: "", brand: "", inn: "", notes: "" });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-ink-50">Клиенты агентства</h2>
          <p className="mt-0.5 text-xs text-ink-500">Конечные заказчики, за которых работает агентство</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
          + Клиент
        </button>
      </div>

      {clients.length === 0 ? (
        <p className="text-sm text-ink-400">Клиентов пока нет.</p>
      ) : (
        <div className="space-y-2">
          {clients.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-ink-800 bg-ink-900/50 px-4 py-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-ink-100">{c.name}</span>
                  {c.brand && <span className="badge badge-brand">{c.brand}</span>}
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-ink-500">
                  {c.inn && <span>ИНН {c.inn}</span>}
                  {c.notes && <span>{c.notes}</span>}
                </div>
              </div>
              <DeleteButton endpoint={`/api/agency-clients/${c.id}`} what={`клиента «${c.name}»`} />
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Клиент агентства" size="sm">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Название клиента *</label>
            <input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} required autoFocus />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Бренд / продукт</label>
              <input className="input" value={f.brand} onChange={(e) => set("brand", e.target.value)} />
            </div>
            <div>
              <label className="label">ИНН</label>
              <input className="input" value={f.inn} onChange={(e) => set("inn", e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Заметки</label>
            <input className="input" value={f.notes} onChange={(e) => set("notes", e.target.value)} />
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
    </section>
  );
}
