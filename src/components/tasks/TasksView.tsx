"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
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
  side: string;
  dueDate: string | Date | null;
  notes: string | null;
  deal: { id: string; title: string } | null;
  advertiser: { id: string; nameRu: string } | null;
  assignee: { id: string; name: string } | null;
};

type Opt = { id: string; title: string };
type AdvOpt = { id: string; nameRu: string };
type UserOpt = { id: string; name: string };

// Доска согласования: две равные половины — наша сторона и сторона клиента.
// Карточка перетаскивается мышкой туда, где сейчас мяч; при возврате от клиента
// правки/комментарии дописываются в карточку (✎).
const SIDES = [
  { key: "Мы", title: "Наша сторона", hint: "делаем/согласуем мы" },
  { key: "Клиент", title: "Сторона клиента", hint: "ждём клиента: согласование, правки, ответ" },
] as const;

export function TasksView({
  tasks,
  deals,
  advertisers,
  users,
}: {
  tasks: Task[];
  deals: Opt[];
  advertisers: AdvOpt[];
  users: UserOpt[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kindFilter, setKindFilter] = useState<string>("");
  const [showDone, setShowDone] = useState(false);
  const [dragOverSide, setDragOverSide] = useState<string | null>(null);
  const dragId = useRef<string | null>(null);

  const filtered = useMemo(() => {
    let list = kindFilter ? tasks.filter((t) => t.kind === kindFilter) : tasks;
    if (!showDone) list = list.filter((t) => t.status !== "Готова");
    return list;
  }, [tasks, kindFilter, showDone]);

  const bySide = useMemo(() => {
    const map: Record<string, Task[]> = { Мы: [], Клиент: [] };
    for (const t of filtered) (map[t.side] ?? map["Мы"]).push(t);
    return map;
  }, [filtered]);

  async function moveTo(side: string) {
    const id = dragId.current;
    dragId.current = null;
    setDragOverSide(null);
    if (!id) return;
    const task = tasks.find((t) => t.id === id);
    if (!task || task.side === side) return;
    await apiFetch(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ side }) });
    router.refresh();
  }

  const doneCount = useMemo(() => tasks.filter((t) => t.status === "Готова").length, [tasks]);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-ink-700 bg-ink-800/60 text-xl">
            ✓
          </div>
          <div>
            <h1 className="text-2xl font-bold text-ink-50">Задачи</h1>
            <p className="mt-0.5 text-sm text-ink-300">
              Перетащите карточку на ту сторону, где сейчас согласование
            </p>
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
        <Chip active={showDone} onClick={() => setShowDone((v) => !v)}>
          ✅ Готовые ({doneCount})
        </Chip>
      </div>

      {/* Две равные половины: мы ↔ клиент */}
      <div className="grid gap-4 lg:grid-cols-2">
        {SIDES.map((side) => (
          <div
            key={side.key}
            onDragOver={(e) => {
              e.preventDefault();
              if (dragOverSide !== side.key) setDragOverSide(side.key);
            }}
            onDragLeave={() => setDragOverSide((s) => (s === side.key ? null : s))}
            onDrop={(e) => {
              e.preventDefault();
              moveTo(side.key);
            }}
            className={`rounded-2xl border p-4 transition ${
              side.key === "Клиент"
                ? "border-sky-500/25 bg-sky-500/[0.04]"
                : "border-ink-700 bg-ink-900/40"
            } ${dragOverSide === side.key ? "outline outline-2 outline-brand/50" : ""}`}
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <div>
                <span className="text-sm font-bold uppercase tracking-wide text-ink-100">
                  {side.key === "Клиент" ? "🤝 " : "🏠 "}
                  {side.title}
                </span>
                <div className="text-xs text-ink-500">{side.hint}</div>
              </div>
              <span className="rounded-md bg-ink-800 px-2 py-0.5 text-xs text-ink-400">
                {bySide[side.key].length}
              </span>
            </div>
            <div className="min-h-[120px] space-y-2.5">
              {bySide[side.key].map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  users={users}
                  onDragStart={() => {
                    dragId.current = t.id;
                  }}
                />
              ))}
              {bySide[side.key].length === 0 && (
                <div className="rounded-xl border border-dashed border-ink-800 py-8 text-center text-xs text-ink-600">
                  пусто — перетащите карточку сюда
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

function TaskCard({
  task,
  users,
  onDragStart,
}: {
  task: Task;
  users: UserOpt[];
  onDragStart: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
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
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", task.id);
        onDragStart();
      }}
      className="card card-hover cursor-grab p-3.5 active:cursor-grabbing"
    >
      {/* Крупная пометка роли-исполнителя (ТЗ р.2, п.2): видно с первого взгляда, кто делает */}
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand/15 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-brand-200 ring-1 ring-inset ring-brand/30">
          {TASK_KIND_EMOJI[task.kind] ?? "•"} {task.kind}
        </span>
        <button
          className="btn-icon h-8 w-8 shrink-0 text-ink-300 hover:text-brand"
          title="Правки / комментарии / дедлайн"
          onClick={() => setEditing(true)}
        >
          <Pencil size={14} strokeWidth={2.2} />
        </button>
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-ink-50">{task.title}</div>
        <div className="mt-1 text-sm text-ink-400">
          {task.deal ? (
            <Link href={`/deals/${task.deal.id}`} className="hover:text-brand">
              {task.deal.title}
            </Link>
          ) : (
            task.advertiser?.nameRu ?? "Без привязки"
          )}
        </div>
      </div>
      {/* Комментарии/правки от клиента или для клиента */}
      {task.notes && (
        <p className="mt-2 whitespace-pre-wrap rounded-lg bg-ink-900/60 px-2.5 py-1.5 text-xs text-ink-300">
          {task.notes}
        </p>
      )}
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-ink-500">
          {task.assignee && (
            <span className="rounded bg-ink-800 px-1.5 py-0.5">{task.assignee.name.split(" ")[0]}</span>
          )}
          {task.dueDate && (
            <span className={overdue ? "font-semibold text-red-300" : ""}>
              {overdue ? "⚠ " : "⏰ "}
              {formatDate(task.dueDate)}
            </span>
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
      {editing && <EditTaskModal task={task} users={users} onClose={() => setEditing(false)} />}
    </div>
  );
}

// Правки/комментарии/вопросы + дедлайн — всё редактируется в карточке.
// Задача с дедлайном автоматически видна на «Сегодня» в «Ближайших задачах».
function EditTaskModal({
  task,
  users,
  onClose,
}: {
  task: Task;
  users: UserOpt[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({
    title: task.title,
    kind: task.kind,
    assigneeId: task.assignee?.id ?? "",
    dueDate: task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : "",
    notes: task.notes ?? "",
    side: task.side,
  });

  function set<K extends keyof typeof f>(k: K, v: string) {
    setF((s) => ({ ...s, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiFetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: f.title,
          kind: f.kind,
          assigneeId: f.assigneeId || undefined,
          dueDate: f.dueDate ? new Date(f.dueDate).toISOString() : undefined,
          notes: f.notes,
          side: f.side,
        }),
      });
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Карточка задачи" subtitle="Правки, комментарии, дедлайн">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Задача *</label>
          <input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} required />
        </div>
        <div>
          <label className="label">Правки / комментарии / вопросы</label>
          <textarea
            className="input min-h-[100px]"
            value={f.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="например: клиент просит заменить макет, ждём финальную сумму, вопрос по срокам…"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Дедлайн</label>
            <input className="input" type="date" value={f.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
          </div>
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
            <label className="label">Сторона</label>
            <select className="input" value={f.side} onChange={(e) => set("side", e.target.value)}>
              <option value="Мы">🏠 Наша</option>
              <option value="Клиент">🤝 Клиента</option>
            </select>
          </div>
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
        <p className="text-xs text-ink-500">
          Задача с дедлайном автоматически попадает в «Сегодня» → «Ближайшие задачи» вместе с комментарием.
        </p>
        <FormError message={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "…" : "Сохранить"}
          </button>
        </div>
      </form>
    </Modal>
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
  deals: Opt[];
  advertisers: AdvOpt[];
  users: UserOpt[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({ title: "", kind: "Менеджер", side: "Мы", dealId: "", advertiserId: "", assigneeId: "", dueDate: "", notes: "" });

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
          side: f.side,
          dealId: f.dealId || undefined,
          advertiserId: f.advertiserId || undefined,
          assigneeId: f.assigneeId || undefined,
          dueDate: f.dueDate ? new Date(f.dueDate).toISOString() : undefined,
          notes: f.notes || undefined,
        }),
      });
      onClose();
      setF({ title: "", kind: "Менеджер", side: "Мы", dealId: "", advertiserId: "", assigneeId: "", dueDate: "", notes: "" });
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
        <div className="grid gap-4 sm:grid-cols-3">
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
            <label className="label">Сторона</label>
            <select className="input" value={f.side} onChange={(e) => set("side", e.target.value)}>
              <option value="Мы">🏠 Наша</option>
              <option value="Клиент">🤝 Клиента</option>
            </select>
          </div>
          <div>
            <label className="label">Исполнитель</label>
            <select className="input" value={f.assigneeId} onChange={(e) => set("assigneeId", e.target.value)}>
              <option value="">— нет —</option>
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
