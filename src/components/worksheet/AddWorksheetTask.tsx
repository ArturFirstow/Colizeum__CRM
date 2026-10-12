"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, FormError } from "@/components/ui/Modal";
import { apiFetch } from "@/lib/client";
import { TASK_KINDS } from "@/lib/enums";

// Постановка задачи прямо в строке клиента: руководитель проекта пишет, на кого
// и к какому сроку. Группа («Документы», «Креативы») — тот самый подзаголовок,
// которым в прежнем задачнике разбивался список по клиенту.
export function AddWorksheetTask({
  advertiserId,
  advertiserName,
  people,
  groups,
  defaultAssigneeId,
}: {
  advertiserId: string;
  advertiserName: string;
  people: { id: string; name: string }[];
  groups: string[];
  defaultAssigneeId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({
    title: "",
    assigneeId: defaultAssigneeId ?? "",
    dueDate: "",
    priority: "Обычный",
    kind: "Менеджер",
    groupLabel: "",
    asproUrl: "",
    notes: "",
  });

  function set<K extends keyof typeof f>(k: K, v: string) {
    setF((s) => ({ ...s, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiFetch("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          advertiserId,
          title: f.title,
          kind: f.kind,
          assigneeId: f.assigneeId || undefined,
          // Поле даты отдаёт «ГГГГ-ММ-ДД», а сервер ждёт полную дату со
          // временем: берём конец дня, иначе «срок сегодня» выглядел бы
          // просроченным с самого утра.
          dueDate: f.dueDate ? new Date(`${f.dueDate}T23:59:59`).toISOString() : undefined,
          priority: f.priority,
          groupLabel: f.groupLabel || undefined,
          asproUrl: f.asproUrl || undefined,
          notes: f.notes || undefined,
        }),
      });
      setOpen(false);
      setF({ ...f, title: "", dueDate: "", asproUrl: "", notes: "" });
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
        + Задача
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Задача по клиенту"
        subtitle={advertiserName}
      >
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Что сделать *</label>
            <input
              className="input"
              required
              value={f.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Довести приложение №4 до подписания"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Кому</label>
              <select
                className="input"
                value={f.assigneeId}
                onChange={(e) => set("assigneeId", e.target.value)}
              >
                <option value="">— не назначено —</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Срок</label>
              <input
                type="date"
                className="input"
                value={f.dueDate}
                onChange={(e) => set("dueDate", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Срочность</label>
              <select
                className="input"
                value={f.priority}
                onChange={(e) => set("priority", e.target.value)}
              >
                {["Срочно", "Высокий", "Обычный", "Низкий"].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Вид работы</label>
              <select className="input" value={f.kind} onChange={(e) => set("kind", e.target.value)}>
                {TASK_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Блок внутри клиента</label>
            <input
              className="input"
              list="worksheet-groups"
              value={f.groupLabel}
              onChange={(e) => set("groupLabel", e.target.value)}
              placeholder="Документы, Креативы, Промокоды…"
            />
            <datalist id="worksheet-groups">
              {groups.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
            <p className="mt-1 text-xs text-ink-500">
              Пусто — задача попадёт в блок «Прочее».
            </p>
          </div>

          <div>
            <label className="label">Ссылка на задачу в Aspro</label>
            <input
              className="input"
              type="url"
              placeholder="https://…"
              value={f.asproUrl}
              onChange={(e) => set("asproUrl", e.target.value)}
            />
          </div>

          <div>
            <label className="label">Подробности</label>
            <textarea
              className="input min-h-[70px]"
              value={f.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>

          <FormError message={error} />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Сохраняем…" : "Поставить"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
