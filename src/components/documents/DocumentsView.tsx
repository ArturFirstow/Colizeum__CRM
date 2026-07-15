"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, FormError } from "@/components/ui/Modal";
import { apiFetch, ApiError } from "@/lib/client";
import { DOCUMENT_TYPES } from "@/lib/enums";
import { formatBytes, formatDateTime } from "@/lib/format";
import { advertiserTypeStyle } from "@/lib/ui-tokens";

type Version = {
  id: string;
  versionNo: number;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  changeNote: string | null;
  createdAt: string | Date;
  uploadedBy: { name: string } | null;
};
type Doc = {
  id: string;
  type: string;
  title: string;
  currentVersionId: string | null;
  versions: Version[];
};
type Advertiser = { id: string; nameRu: string; type: string; documents: Doc[] };

export function DocumentsView({
  advertisers,
  initialAdvertiserId,
}: {
  advertisers: Advertiser[];
  initialAdvertiserId?: string;
}) {
  const [selectedId, setSelectedId] = useState<string>(
    initialAdvertiserId && advertisers.some((a) => a.id === initialAdvertiserId)
      ? initialAdvertiserId
      : advertisers[0]?.id ?? "",
  );
  const [newDocOpen, setNewDocOpen] = useState(false);
  const [uploadDoc, setUploadDoc] = useState<Doc | null>(null);
  const [q, setQ] = useState("");

  const selected = advertisers.find((a) => a.id === selectedId);

  const filteredAdvertisers = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return advertisers;
    return advertisers.filter((a) => a.nameRu.toLowerCase().includes(query));
  }, [advertisers, q]);

  // Группировка документов по типу.
  const grouped = useMemo(() => {
    const map = new Map<string, Doc[]>();
    for (const d of selected?.documents ?? []) {
      const arr = map.get(d.type) ?? [];
      arr.push(d);
      map.set(d.type, arr);
    }
    return [...map.entries()];
  }, [selected]);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-ink-700 bg-ink-800/60 text-xl">
            ❐
          </div>
          <div>
            <h1 className="text-2xl font-bold text-ink-50">Документы</h1>
            <p className="mt-0.5 text-sm text-ink-300">
              Хранилище с версионированием. Новая загрузка = новая версия, старые остаются.
            </p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setNewDocOpen(true)} disabled={!selected}>
          + Документ
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Дерево рекламодателей */}
        <aside className="space-y-2">
          <input
            className="input mb-2"
            placeholder="Поиск рекламодателя…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="card max-h-[70vh] overflow-y-auto p-2">
            {filteredAdvertisers.map((a) => {
              const docCount = a.documents.length;
              return (
                <button
                  key={a.id}
                  onClick={() => setSelectedId(a.id)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition ${
                    a.id === selectedId ? "bg-ink-800 text-brand" : "text-ink-200 hover:bg-ink-800/60"
                  }`}
                >
                  <span className="min-w-0 truncate text-sm font-medium">{a.nameRu}</span>
                  <span className="ml-2 shrink-0 rounded-md bg-ink-900 px-1.5 py-0.5 text-xs text-ink-400">
                    {docCount}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Документы выбранного */}
        <div>
          {!selected ? (
            <div className="card p-10 text-center text-ink-400">Нет рекламодателей</div>
          ) : (
            <>
              <div className="mb-4 flex items-center gap-3">
                <h2 className="text-lg font-bold text-ink-50">{selected.nameRu}</h2>
                <span className={`pill ring-1 ring-inset ${advertiserTypeStyle(selected.type)}`}>
                  {selected.type}
                </span>
              </div>

              {grouped.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-ink-700 bg-ink-900/40 px-6 py-14 text-center">
                  <div className="mb-2 text-4xl">❐</div>
                  <div className="font-semibold text-ink-100">Документов пока нет</div>
                  <div className="mt-1 text-sm text-ink-400">
                    Создайте документ и загрузите первую версию файла.
                  </div>
                  <button className="btn btn-primary mt-4" onClick={() => setNewDocOpen(true)}>
                    + Документ
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {grouped.map(([type, docs]) => (
                    <div key={type}>
                      <div className="mb-2 flex items-center gap-2">
                        <span className="badge badge-brand">{type}</span>
                        <span className="text-xs text-ink-500">{docs.length}</span>
                      </div>
                      <div className="space-y-2">
                        {docs.map((doc) => (
                          <DocumentCard key={doc.id} doc={doc} onUpload={() => setUploadDoc(doc)} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {selected && (
        <NewDocumentModal
          open={newDocOpen}
          onClose={() => setNewDocOpen(false)}
          advertiserId={selected.id}
          advertiserName={selected.nameRu}
        />
      )}
      <UploadVersionModal doc={uploadDoc} onClose={() => setUploadDoc(null)} />
    </div>
  );
}

function DocumentCard({ doc, onUpload }: { doc: Doc; onUpload: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const current = doc.versions[0];

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="truncate font-semibold text-ink-100">{doc.title}</div>
          <div className="mt-0.5 text-xs text-ink-400">
            {current ? (
              <>
                Текущая: <span className="text-brand-200">v{current.versionNo}</span> · {current.fileName} ·{" "}
                {formatBytes(current.sizeBytes)}
              </>
            ) : (
              "Файлов пока нет"
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {current && (
            <a href={`/api/versions/${current.id}/download`} className="btn btn-ghost btn-sm">
              ↓ Скачать
            </a>
          )}
          <button className="btn btn-primary btn-sm" onClick={onUpload}>
            ↑ Версия
          </button>
        </div>
      </div>

      {doc.versions.length > 0 && (
        <div className="border-t border-ink-800">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-2 text-xs text-ink-400 hover:bg-ink-800/40"
          >
            <span>История версий ({doc.versions.length})</span>
            <span>{expanded ? "▲" : "▼"}</span>
          </button>
          {expanded && (
            <div className="divide-y divide-ink-800 border-t border-ink-800">
              {doc.versions.map((v) => (
                <div key={v.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-ink-800 px-1.5 py-0.5 text-xs font-semibold text-brand-200">
                        v{v.versionNo}
                      </span>
                      <span className="truncate text-sm text-ink-200">{v.fileName}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-ink-500">
                      {v.changeNote ? `${v.changeNote} · ` : ""}
                      {formatDateTime(v.createdAt)}
                      {v.uploadedBy ? ` · ${v.uploadedBy.name}` : ""} · {formatBytes(v.sizeBytes)}
                    </div>
                  </div>
                  <a href={`/api/versions/${v.id}/download`} className="btn-icon shrink-0" title="Скачать">
                    ↓
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NewDocumentModal({
  open,
  onClose,
  advertiserId,
  advertiserName,
}: {
  open: boolean;
  onClose: () => void;
  advertiserId: string;
  advertiserName: string;
}) {
  const router = useRouter();
  const [type, setType] = useState<string>(DOCUMENT_TYPES[0]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiFetch("/api/documents", {
        method: "POST",
        body: JSON.stringify({ advertiserId, type, title }),
      });
      onClose();
      setTitle("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Новый документ" subtitle={advertiserName} size="sm">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Тип документа</label>
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            {DOCUMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Название</label>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="напр. «Договор Т-Банк»"
            required
            autoFocus
          />
        </div>
        <FormError message={error} />
        <p className="text-xs text-ink-500">
          Раскладка ручная (MVP). Файл загрузите отдельно кнопкой «Версия».
        </p>
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

function UploadVersionModal({ doc, onClose }: { doc: Doc | null; onClose: () => void }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [changeNote, setChangeNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dupWarning, setDupWarning] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  async function upload(force = false) {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Выберите файл");
      return;
    }
    if (!doc) return;
    setError(null);
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (changeNote) fd.append("changeNote", changeNote);
      if (force) fd.append("force", "true");
      await apiFetch(`/api/documents/${doc.id}/versions`, { method: "POST", body: fd });
      close();
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const detail = err.detail as { duplicateVersionNo?: number } | undefined;
        setDupWarning(detail?.duplicateVersionNo ?? 0);
      } else {
        setError(err instanceof Error ? err.message : "Ошибка");
      }
    } finally {
      setSaving(false);
    }
  }

  function close() {
    setChangeNote("");
    setError(null);
    setDupWarning(null);
    onClose();
  }

  const nextVersion = (doc?.versions[0]?.versionNo ?? 0) + 1;

  return (
    <Modal
      open={!!doc}
      onClose={close}
      title="Загрузить версию"
      subtitle={doc ? `${doc.title} → станет v${nextVersion}` : undefined}
      size="sm"
    >
      <div className="space-y-4">
        <div>
          <label className="label">Файл</label>
          <input
            ref={fileRef}
            type="file"
            className="input file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-1 file:text-sm file:font-semibold file:text-ink-950"
            onChange={() => setDupWarning(null)}
          />
        </div>
        <div>
          <label className="label">Что изменилось</label>
          <input
            className="input"
            value={changeNote}
            onChange={(e) => setChangeNote(e.target.value)}
            placeholder="напр. «правки от 12.07» / «к подписанию»"
          />
        </div>

        {dupWarning !== null && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-sm text-amber-100">
            ⚠️ Такой же файл уже загружен как версия {dupWarning}. Загрузить всё равно?
          </div>
        )}
        <FormError message={error} />

        <div className="flex justify-end gap-2">
          <button className="btn btn-ghost" onClick={close}>
            Отмена
          </button>
          {dupWarning !== null ? (
            <button className="btn btn-primary" disabled={saving} onClick={() => upload(true)}>
              Загрузить всё равно
            </button>
          ) : (
            <button className="btn btn-primary" disabled={saving} onClick={() => upload(false)}>
              {saving ? "Загрузка…" : "Загрузить"}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
