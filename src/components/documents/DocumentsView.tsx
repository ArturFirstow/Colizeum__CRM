"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, FormError } from "@/components/ui/Modal";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { EditDocumentButton } from "@/components/documents/EditDocumentButton";
import { apiFetch, ApiError } from "@/lib/client";
import { FileCell } from "@/components/ui/FileCell";
import { DOCUMENT_TYPES, DOCUMENT_SECTIONS, sectionForDocType } from "@/lib/enums";
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
  dealId?: string | null;
  currentVersionId: string | null;
  versions: Version[];
};
type DealOpt = { id: string; title: string };
type Advertiser = { id: string; nameRu: string; type: string; documents: Doc[]; deals?: DealOpt[] };

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
  const [newDocSection, setNewDocSection] = useState<string | undefined>(undefined);
  const [uploadDoc, setUploadDoc] = useState<Doc | null>(null);
  const [q, setQ] = useState("");

  function openNewDoc(section?: string) {
    setNewDocSection(section);
    setNewDocOpen(true);
  }

  const selected = advertisers.find((a) => a.id === selectedId);

  const filteredAdvertisers = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return advertisers;
    return advertisers.filter((a) => a.nameRu.toLowerCase().includes(query));
  }, [advertisers, q]);

  // Раскладка по фиксированным подразделам (показываем ВСЕ, даже пустые).
  const sections = useMemo(() => {
    const docs = selected?.documents ?? [];
    return DOCUMENT_SECTIONS.map((sec) => ({
      key: sec.key,
      docs: docs.filter((d) => sectionForDocType(d.type) === sec.key),
    }));
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
        <button className="btn btn-primary" onClick={() => openNewDoc()} disabled={!selected}>
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
                <div
                  key={a.id}
                  className={`group flex items-center gap-1 rounded-xl pr-1.5 transition ${
                    a.id === selectedId ? "bg-ink-800" : "hover:bg-ink-800/60"
                  }`}
                >
                  <button
                    onClick={() => setSelectedId(a.id)}
                    className={`flex min-w-0 flex-1 items-center justify-between px-3 py-2.5 text-left ${
                      a.id === selectedId ? "text-brand" : "text-ink-200"
                    }`}
                  >
                    <span className="min-w-0 truncate text-sm font-medium">{a.nameRu}</span>
                    <span className="ml-2 shrink-0 rounded-md bg-ink-900 px-1.5 py-0.5 text-xs text-ink-400">
                      {docCount}
                    </span>
                  </button>
                  {/* Удаление клиента прямо из списка. Текст подтверждения честно
                      называет, сколько документов уйдёт вместе с ним. */}
                  <DeleteButton
                    endpoint={`/api/advertisers/${a.id}`}
                    what={
                      docCount > 0
                        ? `клиента «${a.nameRu}» вместе с ${docCount} документами и всеми их версиями`
                        : `клиента «${a.nameRu}» со всеми его сделками и документами`
                    }
                    className="shrink-0 rounded-lg p-1.5 text-ink-600 opacity-0 transition hover:bg-red-500/15 hover:text-red-300 group-hover:opacity-100"
                  />
                </div>
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

              {/* Быстрая загрузка: файл ложится в общее хранилище клиента и
                  виден там же, где его приложили (сделка, счёт, макет). */}
              <div className="mb-4 rounded-2xl border border-ink-700/70 bg-ink-900/40 p-4">
                <div className="mb-2 text-sm font-semibold text-ink-100">Файлы клиента</div>
                <p className="mb-2.5 text-xs text-ink-500">
                  Перетащите файл сюда или нажмите — счета, макеты и медиапланы из карточек сделок тоже попадают в этот список.
                </p>
                <FileCell
                  ownerType="advertiser"
                  ownerId={selected.id}
                  kind="Документ"
                  advertiserId={selected.id}
                  label="Прикрепить файл с компьютера"
                />
              </div>

              <div className="space-y-3">
                {sections.map((sec) => (
                  <div key={sec.key} className={sec.docs.length === 0 ? "surface px-4 py-2.5" : "surface p-4"}>
                    <div className={`flex items-center gap-2 ${sec.docs.length === 0 ? "" : "mb-3"}`}>
                      <span className={`badge ${sec.docs.length === 0 ? "badge-muted" : "badge-brand"}`}>{sec.key}</span>
                      <span className="text-xs text-ink-500">
                        {sec.docs.length === 0 ? "пока пусто" : sec.docs.length}
                      </span>
                      <button
                        onClick={() => openNewDoc(sec.key)}
                        className="ml-auto text-xs text-ink-400 transition hover:text-brand"
                      >
                        + Добавить
                      </button>
                    </div>
                    {sec.docs.length === 0 ? (
                      <div className="hidden">
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {sec.docs.map((doc) => (
                          <DocumentCard
                            key={doc.id}
                            doc={doc}
                            deals={selected?.deals ?? []}
                            onUpload={() => setUploadDoc(doc)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
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
          presetSection={newDocSection}
        />
      )}
      <UploadVersionModal doc={uploadDoc} onClose={() => setUploadDoc(null)} />
    </div>
  );
}

function DocumentCard({
  doc,
  deals = [],
  onUpload,
}: {
  doc: Doc;
  deals?: DealOpt[];
  onUpload: () => void;
}) {
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
          <button
            className="btn btn-primary btn-sm"
            onClick={onUpload}
            title="Новая редакция ЭТОГО документа — прежняя останется в истории"
          >
            ↑ Версия
          </button>
          <EditDocumentButton doc={doc} deals={deals} />
          <DeleteButton endpoint={`/api/documents/${doc.id}`} what={`документ «${doc.title}»`} />
        </div>
      </div>

      {/* Несколько файлов в одной карточке: два приложения к одному договору
          или ресайзы одного макета — это не версии друг друга, они лежат рядом.
          Версии остаются для правок одного и того же документа. */}
      <div className="border-t border-ink-800 px-4 py-3">
        <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-500">
          Файлы в этой карточке
        </div>
        <FileCell
          ownerType="document"
          ownerId={doc.id}
          kind={doc.type}
          dealId={doc.dealId ?? undefined}
          label="Добавить файлы (можно несколько сразу)"
          compact
        />
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
  presetSection,
}: {
  open: boolean;
  onClose: () => void;
  advertiserId: string;
  advertiserName: string;
  presetSection?: string;
}) {
  const router = useRouter();
  const [section, setSection] = useState<string>(presetSection ?? DOCUMENT_SECTIONS[0].key);
  const currentSection = DOCUMENT_SECTIONS.find((s) => s.key === section) ?? DOCUMENT_SECTIONS[0];
  const typesInSection = currentSection.types as readonly string[];
  const [type, setType] = useState<string>(typesInSection[0]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Синхронизируем раздел с пресетом при открытии.
  useEffect(() => {
    if (open) {
      const sec = presetSection ?? DOCUMENT_SECTIONS[0].key;
      setSection(sec);
      const secTypes =
        (DOCUMENT_SECTIONS.find((s) => s.key === sec)?.types as readonly string[]) ?? DOCUMENT_TYPES;
      setType(secTypes[0]);
    }
  }, [open, presetSection]);

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
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Раздел</label>
            <select
              className="input"
              value={section}
              onChange={(e) => {
                const sec = e.target.value;
                setSection(sec);
                const secTypes =
                  (DOCUMENT_SECTIONS.find((s) => s.key === sec)?.types as readonly string[]) ??
                  DOCUMENT_TYPES;
                setType(secTypes[0]);
              }}
            >
              {DOCUMENT_SECTIONS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.key}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Тип документа</label>
            <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
              {typesInSection.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
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
