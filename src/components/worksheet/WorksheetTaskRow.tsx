"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, ExternalLink, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/client";
import { TASK_STATUSES } from "@/lib/enums";
import { formatDate } from "@/lib/format";

// ─────────────────────────────────────────────────────────────────────────────
// Строка задачи в рабочем листе.
//
// Что в ней важно и почему именно так:
//   • статус меняется прямо в строке — менеджер отмечает «Готова» за одно
//     нажатие, как ставил галочку в документе;
//   • комментарии раскрываются под строкой: это и есть замена припискам
//     «ГОТОВО / ЖДЁМ КЛИЕНТА», только с автором и временем;
//   • просроченный срок красный, срок сегодня — жёлтый. Раньше просрочку
//     замечали глазами, перечитывая документ.
// ─────────────────────────────────────────────────────────────────────────────

export type RowTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  asproUrl: string | null;
  notes: string | null;
  assigneeName: string | null;
  dealTitle: string | null;
  comments: { id: string; text: string; authorName: string | null; createdAt: string }[];
};

const PRIORITY_BAR: Record<string, string> = {
  Срочно: "bg-red-500/70",
  Высокий: "bg-amber-500/70",
  Обычный: "bg-ink-700",
  Низкий: "bg-ink-800",
};

function dueTone(due: string | null, status: string): string {
  if (!due || status === "Готова") return "text-ink-500";
  const d = new Date(due);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (d < new Date(new Date().setHours(0, 0, 0, 0))) return "text-red-300";
  if (d <= today) return "text-amber-300";
  return "text-ink-400";
}

export function WorksheetTaskRow({ task }: { task: RowTask }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function setStatus(status: string) {
    setBusy(true);
    try {
      await apiFetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  }

  async function addComment() {
    const value = text.trim();
    if (!value) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/tasks/${task.id}/comments`, {
        method: "POST",
        body: JSON.stringify({ text: value }),
      });
      setText("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось отправить");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Удалить задачу «${task.title}»?`)) return;
    setBusy(true);
    try {
      await apiFetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Не удалось удалить");
    } finally {
      setBusy(false);
    }
  }

  const done = task.status === "Готова";

  return (
    <div className="rounded-xl border border-ink-800 bg-ink-900/40">
      <div className="flex items-start gap-3 p-3">
        <span
          className={`mt-1 h-10 w-1 shrink-0 rounded-full ${PRIORITY_BAR[task.priority] ?? "bg-ink-700"}`}
          title={`Приоритет: ${task.priority}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className={`text-sm ${done ? "text-ink-500 line-through" : "text-ink-100"}`}>
              {task.title}
            </span>
            {task.asproUrl && (
              <a
                href={task.asproUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-xs text-ink-400 hover:text-brand"
                title="Открыть задачу в Aspro"
              >
                <ExternalLink size={11} /> Aspro
              </a>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className={dueTone(task.dueDate, task.status)}>
              {task.dueDate ? `срок ${formatDate(task.dueDate)}` : "без срока"}
            </span>
            {task.assigneeName && <span className="text-ink-400">{task.assigneeName}</span>}
            {task.dealTitle && <span className="text-ink-500">по сделке «{task.dealTitle}»</span>}
            <button
              className="inline-flex items-center gap-1 text-ink-400 hover:text-brand"
              onClick={() => setOpen((v) => !v)}
            >
              <MessageSquare size={12} />
              {task.comments.length > 0 ? `${task.comments.length}` : "обсудить"}
            </button>
          </div>
          {task.notes && <p className="mt-1.5 text-xs text-ink-400">{task.notes}</p>}
        </div>
        <select
          className="input h-8 w-auto shrink-0 py-0 text-xs"
          value={task.status}
          disabled={busy}
          onChange={(e) => setStatus(e.target.value)}
        >
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button
          className="shrink-0 text-ink-600 transition hover:text-red-300"
          onClick={remove}
          disabled={busy}
          title="Удалить задачу"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {open && (
        <div className="border-t border-ink-800 px-3 py-2.5">
          {task.comments.length === 0 ? (
            <p className="text-xs text-ink-500">
              Комментариев нет. Здесь пишут, что сделано и что мешает, — вместо приписок в
              документе.
            </p>
          ) : (
            <div className="space-y-2">
              {task.comments.map((c) => (
                <div key={c.id} className="text-xs">
                  <span className="text-ink-300">{c.authorName ?? "—"}</span>{" "}
                  <span className="text-ink-600">{formatDate(c.createdAt)}</span>
                  <div className="mt-0.5 whitespace-pre-wrap text-ink-200">{c.text}</div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-2 flex gap-2">
            <input
              className="input h-9 text-sm"
              value={text}
              placeholder="Что сделано, что мешает…"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  addComment();
                }
              }}
            />
            <button className="btn btn-ghost btn-sm" onClick={addComment} disabled={busy || !text.trim()}>
              Отправить
            </button>
          </div>
          {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
        </div>
      )}
    </div>
  );
}
