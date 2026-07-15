"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, FormError } from "@/components/ui/Modal";
import { apiFetch } from "@/lib/client";
import { ADVERTISER_TYPES } from "@/lib/enums";

type Advertiser = {
  id: string;
  nameRu: string;
  nameEn: string | null;
  legalEntity: string | null;
  inn: string | null;
  kpp: string | null;
  ogrn: string | null;
  type: string;
  status: string;
  goals: string | null;
  notes: string | null;
  address: string | null;
  bankName: string | null;
  bankAccount: string | null;
  bik: string | null;
  signatory: string | null;
};

export function EditAdvertiserButton({ advertiser }: { advertiser: Advertiser }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({
    nameRu: advertiser.nameRu,
    type: advertiser.type,
    status: advertiser.status ?? "Активный",
    legalEntity: advertiser.legalEntity ?? "",
    inn: advertiser.inn ?? "",
    kpp: advertiser.kpp ?? "",
    ogrn: advertiser.ogrn ?? "",
    address: advertiser.address ?? "",
    bankName: advertiser.bankName ?? "",
    bankAccount: advertiser.bankAccount ?? "",
    bik: advertiser.bik ?? "",
    signatory: advertiser.signatory ?? "",
    goals: advertiser.goals ?? "",
    notes: advertiser.notes ?? "",
  });

  function set<K extends keyof typeof f>(k: K, v: string) {
    setF((s) => ({ ...s, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiFetch(`/api/advertisers/${advertiser.id}`, {
        method: "PATCH",
        body: JSON.stringify(f),
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
      <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
        ✎ Реквизиты
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Карточка контрагента" size="lg">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Название (бренд) *</label>
              <input className="input" value={f.nameRu} onChange={(e) => set("nameRu", e.target.value)} required />
            </div>
            <div>
              <label className="label">Статус контрагента</label>
              <select className="input" value={f.type} onChange={(e) => set("type", e.target.value)}>
                {ADVERTISER_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Юрлицо</label>
            <input className="input" value={f.legalEntity} onChange={(e) => set("legalEntity", e.target.value)} placeholder="АО «…»" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label">ИНН</label>
              <input className="input" value={f.inn} onChange={(e) => set("inn", e.target.value)} />
            </div>
            <div>
              <label className="label">КПП</label>
              <input className="input" value={f.kpp} onChange={(e) => set("kpp", e.target.value)} />
            </div>
            <div>
              <label className="label">ОГРН</label>
              <input className="input" value={f.ogrn} onChange={(e) => set("ogrn", e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Юр. адрес</label>
            <input className="input" value={f.address} onChange={(e) => set("address", e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Банк</label>
              <input className="input" value={f.bankName} onChange={(e) => set("bankName", e.target.value)} />
            </div>
            <div>
              <label className="label">Р/с</label>
              <input className="input" value={f.bankAccount} onChange={(e) => set("bankAccount", e.target.value)} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">БИК</label>
              <input className="input" value={f.bik} onChange={(e) => set("bik", e.target.value)} />
            </div>
            <div>
              <label className="label">Подписант</label>
              <input className="input" value={f.signatory} onChange={(e) => set("signatory", e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Цели / задачи</label>
            <textarea className="input" value={f.goals} onChange={(e) => set("goals", e.target.value)} />
          </div>
          <div>
            <label className="label">Заметки (внутренние, ⚠️ флаги)</label>
            <textarea className="input" value={f.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
          <FormError message={error} />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Сохранение…" : "Сохранить"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
