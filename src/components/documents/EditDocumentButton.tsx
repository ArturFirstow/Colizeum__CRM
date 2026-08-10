"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Modal, FormError } from "@/components/ui/Modal";
import { apiFetch } from "@/lib/client";
import { DOCUMENT_TYPES } from "@/lib/enums";

type DealOpt = { id: string; title: string };

// Правка карточки документа: название, тип, привязка к сделке.
// Версии файлов остаются на месте — меняется только карточка.
export function EditDocumentButton({
  doc,
  deals = [],
}: {
  doc: { id: string; title: string; type: string; dealId?: string | null };
  deals?: DealOpt[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({
    title: doc.title,
    type: doc.type,
    dealId: doc.dealId ?? "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiFetch(`/api/documents/${doc.id}`, {
        method: "PATCH",
        body: JSON.stringify({ title: f.title, type: f.type, dealId: f.dealId }),
      });
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
      <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)} title="Редактировать документ">
        <Pencil size={14} /> Редактировать
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Редактировать документ" size="sm">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Название *</label>
            <input
              className="input"
              value={f.title}
              onChange={(e) => setF((s) => ({ ...s, title: e.target.value }))}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="label">Тип документа</label>
            <select
              className="input"
              value={f.type}
              onChange={(e) => setF((s) => ({ ...s, type: e.target.value }))}
            >
              {DOCUMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          {deals.length > 0 && (
            <div>
              <label className="label">Сделка</label>
              <select
                className="input"
                value={f.dealId}
                onChange={(e) => setF((s) => ({ ...s, dealId: e.target.value }))}
              >
                <option value="">— без привязки —</option>
                {deals.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </select>
            </div>
          )}
          <FormError message={error} />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Сохраняю…" : "Сохранить"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
