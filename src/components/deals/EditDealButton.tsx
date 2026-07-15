"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, FormError } from "@/components/ui/Modal";
import { apiFetch } from "@/lib/client";
import { URGENCIES } from "@/lib/enums";

type Deal = {
  id: string;
  urgency: string | null;
  amount: number | null;
  contractTotal: number | null;
  paymentTerms: string | null;
  periodText: string | null;
  legalResponsible: string | null;
  blocker: string | null;
  nextStep: string | null;
  decisionPending: string | null;
  notes: string | null;
};

export function EditDealButton({ deal }: { deal: Deal }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({
    urgency: deal.urgency ?? "Средняя",
    amount: deal.amount?.toString() ?? "",
    contractTotal: deal.contractTotal?.toString() ?? "",
    paymentTerms: deal.paymentTerms ?? "",
    periodText: deal.periodText ?? "",
    legalResponsible: deal.legalResponsible ?? "",
    blocker: deal.blocker ?? "",
    nextStep: deal.nextStep ?? "",
    decisionPending: deal.decisionPending ?? "",
    notes: deal.notes ?? "",
  });

  function set<K extends keyof typeof f>(k: K, v: string) {
    setF((s) => ({ ...s, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiFetch(`/api/deals/${deal.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          urgency: f.urgency,
          amount: f.amount ? Number(f.amount) : undefined,
          contractTotal: f.contractTotal ? Number(f.contractTotal) : undefined,
          paymentTerms: f.paymentTerms,
          periodText: f.periodText,
          legalResponsible: f.legalResponsible,
          blocker: f.blocker,
          nextStep: f.nextStep,
          decisionPending: f.decisionPending,
          notes: f.notes,
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
      <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
        ✎ Редактировать
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Редактировать сделку" size="lg">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Срочность</label>
              <select className="input" value={f.urgency} onChange={(e) => set("urgency", e.target.value)}>
                {URGENCIES.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Сумма (₽)</label>
              <input className="input" type="number" value={f.amount} onChange={(e) => set("amount", e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Сумма по договору за весь период (₽)</label>
            <input
              className="input"
              type="number"
              value={f.contractTotal}
              onChange={(e) => set("contractTotal", e.target.value)}
              placeholder="общая сумма сотрудничества"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Схема оплаты</label>
              <input className="input" value={f.paymentTerms} onChange={(e) => set("paymentTerms", e.target.value)} />
            </div>
            <div>
              <label className="label">Юрист</label>
              <input className="input" value={f.legalResponsible} onChange={(e) => set("legalResponsible", e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Срок (текстом)</label>
            <input className="input" value={f.periodText} onChange={(e) => set("periodText", e.target.value)} />
          </div>
          <div>
            <label className="label">Следующий шаг</label>
            <input className="input" value={f.nextStep} onChange={(e) => set("nextStep", e.target.value)} />
          </div>
          <div>
            <label className="label">Блокер</label>
            <input className="input" value={f.blocker} onChange={(e) => set("blocker", e.target.value)} placeholder="что мешает двигаться" />
          </div>
          <div>
            <label className="label">Ожидаемое решение (◆ на дашборд)</label>
            <input
              className="input"
              value={f.decisionPending}
              onChange={(e) => set("decisionPending", e.target.value)}
              placeholder="что нужно решить владельцу"
            />
          </div>
          <div>
            <label className="label">Заметки</label>
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
