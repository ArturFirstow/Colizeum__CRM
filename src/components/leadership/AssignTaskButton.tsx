"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, FormError } from "@/components/ui/Modal";
import { apiFetch } from "@/lib/client";
import { TASK_KINDS } from "@/lib/enums";

type Client = { id: string; nameRu: string };

function isoInDays(days: number) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Кнопка + модалка «поручить задачу сотруднику» (только руководитель).
export function AssignTaskButton({
  employee,
  clients = [],
  variant = "button",
  label = "Поручить задачу",
}: {
  employee: { id: string; name: string };
  clients?: Client[];
  variant?: "button" | "row";
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({ title: "", kind: "Менеджер", advertiserId: "", dueDate: "", notes: "" });

  function set<K extends keyof typeof f>(k: K, v: string) {
    setF((s) => ({ ...s, [k]: v }));
  }
  function reset() {
    setF({ title: "", kind: "Менеджер", advertiserId: "", dueDate: "", notes: "" });
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiFetch("/api/leadership/tasks", {
        method: "POST",
        body: JSON.stringify({
          assigneeId: employee.id,
          title: f.title,
          kind: f.kind,
          advertiserId: f.advertiserId || undefined,
          dueDate: f.dueDate ? new Date(f.dueDate).toISOString() : undefined,
          notes: f.notes || undefined,
        }),
      });
      reset();
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  const trigger =
    variant === "row" ? (
      <button
        onClick={() => setOpen(true)}
        title={`Поручить задачу: ${employee.name}`}
        className="rounded-lg border border-brand/40 bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand-200 transition hover:bg-brand/20"
      >
        + Поручить
      </button>
    ) : (
      <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}>
        + {label}
      </button>
    );

  return (
    <>
      {trigger}
      <Modal open={open} onClose={() => setOpen(false)} title={`Поручение: ${employee.name}`} subtitle="Задача попадёт в кабинет сотрудника с пометкой «от руководителя»" size="lg">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Поручение *</label>
            <input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} required autoFocus placeholder="напр. Дать статус по клиенту Алабуга к пятнице" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Вид</label>
              <select className="input" value={f.kind} onChange={(e) => set("kind", e.target.value)}>
                {TASK_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">По клиенту (необязательно)</label>
              <select className="input" value={f.advertiserId} onChange={(e) => set("advertiserId", e.target.value)}>
                <option value="">— без привязки —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nameRu}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Срок</label>
            <div className="flex flex-wrap items-center gap-2">
              <input className="input max-w-[200px]" type="date" value={f.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
              <button type="button" className="pill bg-ink-800/60 text-ink-200 ring-1 ring-inset ring-ink-700 hover:bg-ink-800" onClick={() => set("dueDate", isoInDays(0))}>
                Сегодня
              </button>
              <button type="button" className="pill bg-ink-800/60 text-ink-200 ring-1 ring-inset ring-ink-700 hover:bg-ink-800" onClick={() => set("dueDate", isoInDays(1))}>
                Завтра
              </button>
              <button type="button" className="pill bg-ink-800/60 text-ink-200 ring-1 ring-inset ring-ink-700 hover:bg-ink-800" onClick={() => set("dueDate", isoInDays(7))}>
                Через неделю
              </button>
            </div>
          </div>
          <div>
            <label className="label">Детали / поручение</label>
            <textarea className="input min-h-[80px]" value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="что именно нужно сделать, к какому результату" />
          </div>
          <FormError message={error} />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "…" : "Поручить"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
