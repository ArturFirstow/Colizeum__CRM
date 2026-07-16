"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, FormError } from "@/components/ui/Modal";
import { apiFetch } from "@/lib/client";
import { CONTRACT_CONSTRUCTIONS, DEAL_STAGES, URGENCIES } from "@/lib/enums";

type Opt = { id: string; nameRu: string };

export function NewDealButton({
  advertisers,
  presetAdvertiserId,
  label = "+ Сделка",
  className = "btn btn-primary",
}: {
  advertisers?: Opt[];
  presetAdvertiserId?: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    advertiserId: presetAdvertiserId ?? "",
    title: "",
    stage: DEAL_STAGES[0] as string,
    urgency: "Средняя",
    dealType: "",
    finalBrand: "",
    contractConstruction: "",
    amount: "",
    vatIncluded: true,
    periodText: "",
    launchDate: "",
    nextStep: "",
    situational: "",
    notes: "",
  });

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiFetch("/api/deals", {
        method: "POST",
        body: JSON.stringify({
          advertiserId: form.advertiserId,
          title: form.title,
          stage: form.stage,
          urgency: form.urgency,
          dealType: form.dealType || undefined,
          finalBrand: form.finalBrand || undefined,
          contractConstruction: form.contractConstruction || undefined,
          amount: form.amount ? Number(form.amount) : undefined,
          vatIncluded: form.vatIncluded,
          periodText: form.periodText || undefined,
          launchDate: form.launchDate || undefined,
          nextStep: form.nextStep || undefined,
          situational: form.situational || undefined,
          notes: form.notes || undefined,
        }),
      });
      setOpen(false);
      setForm((f) => ({ ...f, title: "", finalBrand: "", amount: "", periodText: "", launchDate: "", nextStep: "", situational: "", notes: "" }));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button className={className} onClick={() => setOpen(true)}>
        {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Новая сделка" size="lg">
        <form onSubmit={submit} className="space-y-4">
          {!presetAdvertiserId && (
            <div>
              <label className="label">Рекламодатель *</label>
              <select
                className="input"
                value={form.advertiserId}
                onChange={(e) => set("advertiserId", e.target.value)}
                required
              >
                <option value="">— выбрать —</option>
                {advertisers?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nameRu}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label">Название сделки *</label>
            <input className="input" value={form.title} onChange={(e) => set("title", e.target.value)} required autoFocus />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Стадия</label>
              <select className="input" value={form.stage} onChange={(e) => set("stage", e.target.value)}>
                {DEAL_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Срочность</label>
              <select className="input" value={form.urgency} onChange={(e) => set("urgency", e.target.value)}>
                {URGENCIES.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Тип сделки</label>
              <select className="input" value={form.dealType} onChange={(e) => set("dealType", e.target.value)}>
                <option value="">— не указан —</option>
                <option value="Прямой">Прямой</option>
                <option value="Агентство">Агентство</option>
              </select>
            </div>
            <div>
              <label className="label">Конечный бренд</label>
              <input
                className="input"
                value={form.finalBrand}
                onChange={(e) => set("finalBrand", e.target.value)}
                placeholder="если через агентство"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Конструкция договора</label>
              <select
                className="input"
                value={form.contractConstruction}
                onChange={(e) => set("contractConstruction", e.target.value)}
              >
                <option value="">— не выбрано —</option>
                {CONTRACT_CONSTRUCTIONS.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Сумма (₽)</label>
              <input
                className="input"
                type="number"
                value={form.amount}
                onChange={(e) => set("amount", e.target.value)}
                placeholder="из МП"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Срок (текстом)</label>
              <input
                className="input"
                value={form.periodText}
                onChange={(e) => set("periodText", e.target.value)}
                placeholder="напр. «старт после предоплаты 40%»"
              />
            </div>
            <div>
              <label className="label">Дата запуска</label>
              <input className="input" type="date" value={form.launchDate} onChange={(e) => set("launchDate", e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Следующий шаг</label>
            <input className="input" value={form.nextStep} onChange={(e) => set("nextStep", e.target.value)} />
          </div>
          <div>
            <label className="label">Ситуативные блокеры и срочные задачи</label>
            <textarea
              className="input"
              value={form.situational}
              onChange={(e) => set("situational", e.target.value)}
              placeholder="временное: правки макета, ждём ответ и т.п."
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-200">
            <input
              type="checkbox"
              checked={form.vatIncluded}
              onChange={(e) => set("vatIncluded", e.target.checked)}
              className="h-4 w-4 accent-brand"
            />
            Сумма с НДС
          </label>
          <FormError message={error} />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Сохранение…" : "Создать сделку"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
