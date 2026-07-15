"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, FormError } from "@/components/ui/Modal";
import { apiFetch } from "@/lib/client";
import { PROMO_MECHANICS, MONETIZATIONS } from "@/lib/enums";

type Adv = { id: string; nameRu: string };

export function NewPromoButton({ advertisers }: { advertisers: Adv[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({
    advertiserId: "",
    mechanic: "Acquisition",
    nominal: "",
    qty: "",
    delayHours: "12",
    monetization: "Деньги",
    validFrom: "",
    validTo: "",
    commercialTerms: "",
    settlement: "",
    vatOnUsed: true,
  });

  function set<K extends keyof typeof f>(k: K, v: (typeof f)[K]) {
    setF((s) => ({ ...s, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiFetch("/api/promo", {
        method: "POST",
        body: JSON.stringify({
          advertiserId: f.advertiserId,
          mechanic: f.mechanic,
          nominal: f.nominal ? Number(f.nominal) : undefined,
          qty: f.qty ? Number(f.qty) : undefined,
          delayHours: f.delayHours ? Number(f.delayHours) : undefined,
          monetization: f.monetization,
          validFrom: f.validFrom ? new Date(f.validFrom).toISOString() : undefined,
          validTo: f.validTo ? new Date(f.validTo).toISOString() : undefined,
          commercialTerms: f.commercialTerms || undefined,
          settlement: f.settlement || undefined,
          vatOnUsed: f.vatOnUsed,
        }),
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
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        + Партия
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Партия промокодов" size="lg">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Рекламодатель *</label>
            <select className="input" value={f.advertiserId} onChange={(e) => set("advertiserId", e.target.value)} required>
              <option value="">— выбрать —</option>
              {advertisers.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nameRu}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Механика</label>
              <select className="input" value={f.mechanic} onChange={(e) => set("mechanic", e.target.value)}>
                {PROMO_MECHANICS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Монетизация</label>
              <select className="input" value={f.monetization} onChange={(e) => set("monetization", e.target.value)}>
                {MONETIZATIONS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label">Номинал ₽</label>
              <input className="input" type="number" value={f.nominal} onChange={(e) => set("nominal", e.target.value)} />
            </div>
            <div>
              <label className="label">Количество</label>
              <input className="input" type="number" value={f.qty} onChange={(e) => set("qty", e.target.value)} />
            </div>
            <div>
              <label className="label">Отсрочка (ч)</label>
              <input className="input" type="number" value={f.delayHours} onChange={(e) => set("delayHours", e.target.value)} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Действует с</label>
              <input className="input" type="date" value={f.validFrom} onChange={(e) => set("validFrom", e.target.value)} />
            </div>
            <div>
              <label className="label">по</label>
              <input className="input" type="date" value={f.validTo} onChange={(e) => set("validTo", e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Коммерческие условия</label>
            <input className="input" value={f.commercialTerms} onChange={(e) => set("commercialTerms", e.target.value)} />
          </div>
          <div>
            <label className="label">Взаиморасчёт</label>
            <input className="input" value={f.settlement} onChange={(e) => set("settlement", e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-200">
            <input type="checkbox" className="h-4 w-4 accent-brand" checked={f.vatOnUsed} onChange={(e) => set("vatOnUsed", e.target.checked)} />
            +22% НДС на использованные
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
