"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Upload, FileText, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/client";
import { formatBytes } from "@/lib/format";

export type KFile = {
  id: string;
  title: string;
  category: string;
  description: string | null;
  fileName: string;
  sizeBytes: number;
};

// Рабочие файлы рядом с регламентами: шаблон договора, прайс, презентация.
// Новичок читает раздел — и тут же скачивает документ, не бегая по чатам.
export function KnowledgeFiles({ files }: { files: KFile[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(list: FileList | null) {
    if (!list || list.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      for (const f of Array.from(list)) {
        const fd = new FormData();
        fd.append("file", f);
        fd.append("title", f.name.replace(/\.[^.]+$/, ""));
        await apiFetch("/api/knowledge/files", { method: "POST", body: fd });
      }
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить");
    } finally {
      setBusy(false);
    }
  }

  async function remove(f: KFile) {
    if (!confirm(`Удалить файл «${f.title}»?`)) return;
    setBusy(true);
    try {
      await apiFetch(`/api/knowledge/files/${f.id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-base font-semibold uppercase tracking-wide text-ink-50">Файлы и шаблоны</h2>
          <p className="mt-0.5 text-xs text-ink-400">Договор, прайс, презентация — всё, что отправляем клиенту</p>
        </div>
        <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => inputRef.current?.click()}>
          <Upload size={14} /> {busy ? "Загружаю…" : "Загрузить"}
        </button>
        <input ref={inputRef} type="file" multiple hidden onChange={(e) => upload(e.target.files)} />
      </div>

      {error && <div className="mb-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</div>}

      {files.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink-700 px-4 py-5 text-center text-xs text-ink-500">
          Файлов пока нет. Загрузите шаблон договора, прайс-лист и презентацию — они будут под рукой у всей команды.
        </p>
      ) : (
        <div className="space-y-1.5">
          {files.map((f) => (
            <div key={f.id} className="group flex items-center gap-3 rounded-xl bg-ink-900/50 px-3 py-2 transition hover:bg-ink-800/60">
              <FileText size={16} className="shrink-0 text-brand/80" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-ink-100">{f.title}</div>
                <div className="truncate text-[11px] text-ink-500">
                  {f.fileName} · {formatBytes(f.sizeBytes)}
                  {f.description ? ` · ${f.description}` : ""}
                </div>
              </div>
              <a
                href={`/api/knowledge/files/${f.id}`}
                className="btn-icon h-8 w-8 text-ink-400 hover:text-brand"
                title="Скачать"
              >
                <Download size={14} />
              </a>
              <button
                className="btn-icon h-8 w-8 text-ink-500 opacity-0 transition group-hover:opacity-100 hover:text-red-400"
                title="Удалить"
                onClick={() => remove(f)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
