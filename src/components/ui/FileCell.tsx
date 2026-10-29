"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Paperclip, Download, Trash2, Upload } from "lucide-react";
import { apiFetch } from "@/lib/client";
import { formatBytes } from "@/lib/format";

export type FileAssetLite = {
  id: string;
  title: string;
  fileName: string;
  sizeBytes: number;
  kind: string;
  uploadedByName: string | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Ячейка с файлами — вставляется в любой блок сервиса (счета, медиапланы,
// креативы, карточки базы знаний). Файлы лежат в одном хранилище, поэтому
// приложенное в сделке видно и в «Документах» клиента.
// Поддерживает перетаскивание файла мышью прямо на блок.
// ─────────────────────────────────────────────────────────────────────────────
export function FileCell({
  ownerType,
  ownerId,
  kind = "Прочее",
  advertiserId,
  dealId,
  label = "Прикрепить файл",
  compact,
}: {
  ownerType: string;
  ownerId: string;
  kind?: string;
  advertiserId?: string;
  dealId?: string;
  label?: string;
  compact?: boolean;
}) {
  const [files, setFiles] = useState<FileAssetLite[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const list = await apiFetch<FileAssetLite[]>(
        `/api/files?ownerType=${encodeURIComponent(ownerType)}&ownerId=${encodeURIComponent(ownerId)}&kind=${encodeURIComponent(kind)}`,
      );
      setFiles(list);
    } catch {
      /* тихо */
    }
  }, [ownerType, ownerId, kind]);

  useEffect(() => {
    load();
  }, [load]);

  async function upload(list: FileList | File[] | null) {
    const arr = list ? Array.from(list) : [];
    if (arr.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      for (const f of arr) {
        const fd = new FormData();
        fd.append("file", f);
        fd.append("ownerType", ownerType);
        fd.append("ownerId", ownerId);
        fd.append("kind", kind);
        fd.append("title", f.name.replace(/\.[^.]+$/, ""));
        if (advertiserId) fd.append("advertiserId", advertiserId);
        if (dealId) fd.append("dealId", dealId);
        await apiFetch("/api/files", { method: "POST", body: fd });
      }
      if (inputRef.current) inputRef.current.value = "";
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить файл");
    } finally {
      setBusy(false);
    }
  }

  async function remove(f: FileAssetLite) {
    if (!confirm(`Удалить файл «${f.title}»?`)) return;
    setBusy(true);
    try {
      await apiFetch(`/api/files/${f.id}`, { method: "DELETE" });
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        upload(e.dataTransfer.files);
      }}
      className={`rounded-xl transition ${dragOver ? "ring-2 ring-inset ring-brand/50" : ""}`}
    >
      {files.length > 0 && (
        <div className={`mb-2 space-y-1 ${compact ? "" : "space-y-1.5"}`}>
          {files.map((f) => (
            <div
              key={f.id}
              className="group flex items-center gap-2 rounded-lg bg-ink-900/60 px-3 py-2 text-sm ring-1 ring-inset ring-ink-800"
            >
              <Paperclip size={14} className="shrink-0 text-brand/70" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-ink-100">{f.title}</span>
                <span className="block truncate text-xs text-ink-500">
                  {f.fileName} · {formatBytes(f.sizeBytes)}
                  {f.uploadedByName ? ` · ${f.uploadedByName}` : ""}
                </span>
              </span>
              <a
                href={`/api/files/${f.id}`}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-400 transition hover:bg-ink-800 hover:text-brand"
                title="Скачать"
              >
                <Download size={16} />
              </a>
              <button
                onClick={() => remove(f)}
                disabled={busy}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-500 transition hover:bg-ink-800 hover:text-red-400"
                title="Удалить"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className={`flex w-full items-center justify-center gap-2 rounded-lg border border-dashed px-3 text-sm transition ${
          dragOver ? "border-brand/60 text-brand" : "border-ink-700 text-ink-400 hover:border-brand/40 hover:text-brand-200"
        } ${compact ? "py-2.5" : "py-3"}`}
      >
        <Upload size={15} /> {busy ? "Загружаю…" : label}
      </button>
      <input ref={inputRef} type="file" multiple hidden onChange={(e) => upload(e.target.files)} />

      {error && <div className="mt-1 text-[11px] text-red-300">{error}</div>}
    </div>
  );
}
