"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Modal, FormError } from "@/components/ui/Modal";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { apiFetch } from "@/lib/client";
import { TASK_KINDS, TASK_STATUSES } from "@/lib/enums";
import { TASK_KIND_EMOJI } from "@/lib/ui-tokens";
import { formatDate } from "@/lib/format";

type Task = {
  id: string;
  title: string;
  kind: string;
  status: string;
  dueDate: string | Date | null;
  notes: string | null;
  deal: { id: string; title: string } | null;
  advertiser: { id: string; nameRu: string } | null;
  assignee: { id: string; name: string } | null;
};

export function TasksView({
  tasks,
  deals,
  advertisers,
  users,
}: {
  tasks: Task[];
  deals: { id: string; title: string }[];
  advertisers: { id: string; nameRu: string }[];
  users: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [kindFilter, setKindFilter] = useState<string>("");

  const filtered = useMemo(
    () => (kindFilter ? tasks.filter((t) => t.kind === kindFilter) : tasks),
    [tasks, kindFilter],
  );

  const byStatus = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const s of TASK_STATUSES) map[s] = [];
    for (const t of filtered) (map[t.status] ??= []).push(t);
    return map;
  }, [filtered]);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-ink-700 bg-ink-800/60 text-xl">
            ✓
          </div>
          <div>
            <h1 className="text-2xl font-bold text-ink-50">Задачи</h1>
            <p className="mt-0.5 text-sm text-ink-300">По видам, с делегированием и дедлайнами</p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setOpen(true)}>
          + Задача
        </button>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <Chip active={kindFilter === ""} onClick={() => setKindFilter("")}>
          Все
        </Chip>
        {TASK_KINDS.map((k) => (
          <Chip key={k} active={kindFilter === k} onClick={() => setKindFilter(k)}>
            {TASK_KIND_EMOJI[k]} {k}
          </Chip>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {TASK_STATUSES.map((status) => (
          <div key={status}>
            <div className="mb-3 flex items-center justify-between px-1">
              <span className="text-sm font-semibold text-ink-200">{status}</span>
              <span className="rounded-md bg-ink-800 px-2 py-0.5 text-xs text-ink-400">
                {byStatus[status].length}
              </span>
            </div>
            <div className="space-y-2.5">
              {byStatus[status].map((t) => (
                <TaskCard key={t.id} task={t} />
              ))}
              {byStatus[status].length === 0 && (
                <div className="rounded-xl border border-dashed border-ink-800 py-6 text-center text-xs text-ink-600">
                  пусто
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <NewTaskModal
        open={open}
        onClose={() => setOpen(false)}
        deals={deals}
        advertisers={advertisers}
        users={users}
      />
    </div>
  );
}

function TaskCard({ task }: { task: Task }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const overdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "Готова";

  async function changeStatus(status: string) {
    setBusy(true);
    try {
      await apiFetch(`/api/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-3.5">
      <div className="flex items-start gap-2">
        <span className="text-base">{TASK_KIND_EMOJI[task.kind] ?? "•"}</span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-ink-100">{task.title}</div>
          <div className="mt-1 text-xs text-ink-500">
            {task.deal ? (
              <Link href={`/deals/${task.deal.id}`} className="hover:text-brand">
                {task.deal.title}
              </Link>
            ) : (
              task.advertiser?.nameRu ?? "Без привязки"
            )}
          </div>
        </div>
      </div>
      {task.notes && <p className="mt-2 text-xs text-ink-400">{task.notes}</p>}
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-ink-500">
          {task.assignee && (
            <span className="rounded bg-ink-800 px-1.5 py-0.5">{task.assignee.name.split(" ")[0]}</span>
          )}
          {task.dueDate && (
            <span className={overdue ? "text-red-300" : ""}>{formatDate(task.dueDate)}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <select
            className="rounded-lg border border-ink-700 bg-ink-900 px-2 py-1 text-xs text-ink-200"
            value={task.status}
            disabled={busy}
            onChange={(e) => changeStatus(e.target.value)}
          >
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <DeleteButton endpoint={`/api/tasks/${task.id}`} what="задачу" />
        </div>
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
        active ? "border-brand/50 bg-brand/15 text-brand-200" : "border-ink-700 bg-ink-800/50 text-ink-300 hover:bg-ink-700"
      }`}
    >
      {children}
    </button>
  );
}

function NewTaskModal({
  open,
  onClose,
  deals,
  advertisers,
  users,
}: {
  open: boolean;
  onClose: () => void;
  deals: { id: string; title: string }[];
  advertisers: { id: string; nameRu: string }[];
  users: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({ title: "", kind: "Менеджер", dealId: "", advertiserId: "", assigneeId: "", dueDate: "", notes: "" });

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
          title: f.title,
          kind: f.kind,
          dealId: f.dealId || undefined,
          advertiserId: f.advertiserId || undefined,
          assigneeId: f.assigneeId || undefined,
          dueDate: f.dueDate ? new Date(f.dueDate).toISOString() : undefined,
          notes: f.notes || undefined,
        }),
      });
      onClose();
      setF({ title: "", kind: "Менеджер", dealId: "", advertiserId: "", assigneeId: "", dueDate: "", notes: "" });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Новая задача">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Задача *</label>
          <input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} required autoFocus />
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
            <label className="label">Исполнитель</label>
            <select className="input" value={f.assigneeId} onChange={(e) => set("assigneeId", e.target.value)}>
              <option value="">— не назначен —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Сделка</label>
            <select className="input" value={f.dealId} onChange={(e) => set("dealId", e.target.value)}>
              <option value="">— нет —</option>
              {deals.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Дедлайн</label>
            <input className="input" type="date" value={f.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Заметки</label>
          <textarea className="input" value={f.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>
        <FormError message={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "…" : "Создать"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
