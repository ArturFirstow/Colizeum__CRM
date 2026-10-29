"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Upload, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/client";
import { formatBytes } from "@/lib/format";
import { DeleteButton } from "@/components/ui/DeleteButton";

// ─────────────────────────────────────────────────────────────────────────────
// Доска материалов для клиента — то, что отправляют рекламодателю: медиакит,
// исследование аудитории, техтребования, шаблоны.
//
// КАК БЫЛО. Семь одинаковых карточек, и в каждой — крупная кнопка «Загрузить
// файл», даже когда файла нет. Экран читался как анкета на семь полей, хотя
// задача у человека ровно одна: быстро ВЗЯТЬ нужный файл и отправить клиенту.
//
// КАК СТАЛО. Доска, на которую приколоты файлы. Главное действие плитки —
// «Скачать», оно же самое заметное. Пустая плитка не кричит: тихий пунктир,
// файл в неё можно перетащить мышью. Замена файла — одной кнопкой рядом.
// ─────────────────────────────────────────────────────────────────────────────

type FileLite = { id: string; title: string; fileName: string; sizeBytes: number };

export type Material = { id: string; title: string; notes: string | null };

export function MaterialBoard({
  materials,
  onOpen,
}: {
  materials: Material[];
  /** Открыть статью с описанием материала. */
  onOpen: (id: string) => void;
}) {
  if (materials.length === 0) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {materials.map((m) => (
        <MaterialTile key={m.id} material={m} onOpen={() => onOpen(m.id)} />
      ))}
    </div>
  );
}

function MaterialTile({ material, onOpen }: { material: Material; onOpen: () => void }) {
  const [files, setFiles] = useState<FileLite[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const list = await apiFetch<FileLite[]>(
        `/api/files?ownerType=knowledge&ownerId=${encodeURIComponent(material.id)}&kind=${encodeURIComponent("Материал")}`,
      );
      setFiles(list);
    } catch {
      /* тихо: доска не должна падать из-за одной плитки */
    }
  }, [material.id]);

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
        fd.append("ownerType", "knowledge");
        fd.append("ownerId", material.id);
        fd.append("kind", "Материал");
        fd.append("title", f.name.replace(/\.[^.]+$/, ""));
        await apiFetch("/api/files", { method: "POST", body: fd });
      }
      if (inputRef.current) inputRef.current.value = "";
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить");
    } finally {
      setBusy(false);
    }
  }

  const main = files[0];
  const extra = files.slice(1);

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
      className={`flex min-h-[8.5rem] min-w-0 flex-col rounded-2xl border p-3.5 transition ${
        dragOver
          ? "border-brand bg-brand/10"
          : main
            ? "border-ink-700 bg-ink-900/60 hover:border-ink-600"
            : "border-dashed border-ink-700/70 bg-ink-900/25"
      }`}
    >
      <button onClick={onOpen} className="block w-full text-left" title="Открыть описание">
        <div className="truncate text-sm font-semibold text-ink-100 hover:text-brand">
          {material.title}
        </div>
        {material.notes && (
          <div className="mt-0.5 truncate text-xs text-ink-500">{material.notes}</div>
        )}
      </button>

      <div className="mt-auto pt-3">
        {main ? (
          <>
            <div className="flex items-center gap-1.5">
              {/* Скачать — главное действие плитки, поэтому оно и самое заметное */}
              <a
                href={`/api/files/${main.id}`}
                className="btn btn-ghost btn-sm min-w-0 flex-1 justify-start"
                title={main.fileName}
              >
                <Download size={15} />
                <span className="truncate">Скачать</span>
                <span className="ml-auto shrink-0 text-xs text-ink-500">
                  {formatBytes(main.sizeBytes)}
                </span>
              </a>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={busy}
                title="Загрузить новый файл взамен"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-500 transition hover:bg-ink-800 hover:text-brand"
              >
                <RefreshCw size={15} />
              </button>
              <DeleteButton endpoint={`/api/files/${main.id}`} what={`файл «${main.title}»`} />
            </div>
            <div className="mt-1 truncate text-[11px] text-ink-600" title={main.fileName}>
              {main.fileName}
              {extra.length > 0 && ` · и ещё ${extra.length}`}
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-ink-700 py-3 text-xs text-ink-500 transition hover:border-brand/40 hover:text-brand-200"
          >
            <Upload size={14} />
            {busy ? "Загружаю…" : "Файла нет — перетащите или нажмите"}
          </button>
        )}
      </div>

      <input ref={inputRef} type="file" hidden onChange={(e) => upload(e.target.files)} />
      {error && <div className="mt-1 text-[11px] text-red-300">{error}</div>}
    </div>
  );
}
