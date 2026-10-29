"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileText, Plus, Upload } from "lucide-react";
import { Modal, FormError } from "@/components/ui/Modal";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { EditDocumentButton } from "@/components/documents/EditDocumentButton";
import { apiFetch, ApiError } from "@/lib/client";
import { FileCell } from "@/components/ui/FileCell";
import { DOCUMENT_TYPES, DOCUMENT_SECTIONS, sectionForDocType } from "@/lib/enums";
import { formatBytes, formatDate, formatDateTime, plural } from "@/lib/format";
import { advertiserTypeStyle } from "@/lib/ui-tokens";

// ─────────────────────────────────────────────────────────────────────────────
// «Документы» — восемь корзин, как в бумажном органайзере.
//
// КАК БЫЛО. Восемь разделов шли ОДИНАКОВЫМИ СТРОКАМИ сверху вниз, и у клиента
// без документов экран выглядел так: восемь раз «пока пусто» и восемь кнопок
// «+ Добавить». Пустые заготовки занимали больше места, чем данные.
//
// КАК СТАЛО. Разделы разложены сеткой крупных корзин. У корзины написано, что
// в неё кладут, и файл в неё можно просто ПЕРЕТАЩИТЬ — карточка документа и
// первая версия создаются сами, без формы. Внутри корзины документы идут
// хронологией: сверху свежая версия с датой и пометкой «свежая», остальные —
// под кнопкой «история».
//
// ⚠️ Создание документа формой («+ Документ») осталось: оно нужно, когда
// карточку заводят заранее, до того как пришёл файл.
// ─────────────────────────────────────────────────────────────────────────────

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
  // ⚠️ По умолчанию открываем клиента, у которого документы ЕСТЬ: раньше
  // открывался первый по алфавиту, и экран встречал пустотой, хотя документы
  // в сервисе были.
  const [selectedId, setSelectedId] = useState<string>(() => {
    if (initialAdvertiserId && advertisers.some((a) => a.id === initialAdvertiserId)) {
      return initialAdvertiserId;
    }
    const withDocs = [...advertisers].sort((a, b) => b.documents.length - a.documents.length)[0];
    return withDocs?.documents.length ? withDocs.id : advertisers[0]?.id ?? "";
  });
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

  const sections = useMemo(() => {
    const docs = selected?.documents ?? [];
    return DOCUMENT_SECTIONS.map((sec) => ({
      key: sec.key as string,
      types: sec.types as readonly string[],
      // Свежие документы сверху: ориентир — дата последней версии.
      docs: docs
        .filter((d) => sectionForDocType(d.type) === sec.key)
        .sort((a, b) => versionTime(b) - versionTime(a)),
    }));
  }, [selected]);

  const total = selected?.documents.length ?? 0;

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
              Перетащите файл в нужную корзину — он ляжет туда новой версией, прежние останутся.
            </p>
          </div>
        </div>
        <button className="btn btn-ghost" onClick={() => openNewDoc()} disabled={!selected}>
          <Plus size={15} /> Завести карточку
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        {/* Клиенты */}
        <aside className="space-y-2">
          <input
            className="input mb-2"
            placeholder="Поиск клиента…"
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
                    {/* Ноль не пишем: столбец нулей ничего не сообщает. */}
                    {docCount > 0 && (
                      <span className="ml-2 shrink-0 rounded-md bg-ink-900 px-1.5 py-0.5 text-xs text-ink-400">
                        {docCount}
                      </span>
                    )}
                  </button>
                  <DeleteButton
                    endpoint={`/api/advertisers/${a.id}`}
                    what={
                      docCount > 0
                        ? `клиента «${a.nameRu}» вместе с ${docCount} документами и всеми их версиями`
                        : `клиента «${a.nameRu}» со всеми его сделками и документами`
                    }
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-500 transition hover:bg-red-500/10 hover:text-red-400"
                  />
                </div>
              );
            })}
          </div>
        </aside>

        {/* Корзины выбранного клиента */}
        <div>
          {!selected ? (
            <div className="card p-10 text-center text-ink-400">Клиентов нет</div>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <h2 className="text-lg font-bold text-ink-50">{selected.nameRu}</h2>
                <span className={`pill ring-1 ring-inset ${advertiserTypeStyle(selected.type)}`}>
                  {selected.type}
                </span>
                <span className="text-xs text-ink-500">
                  {total > 0
                    ? `${total} ${plural(total, "документ", "документа", "документов")}`
                    : "документов пока нет — перетащите файл в корзину"}
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {sections.map((sec) => (
                  <SectionBasket
                    key={sec.key}
                    sectionKey={sec.key}
                    types={sec.types}
                    docs={sec.docs}
                    advertiserId={selected.id}
                    deals={selected.deals ?? []}
                    onAdd={() => openNewDoc(sec.key)}
                    onUploadVersion={(doc) => setUploadDoc(doc)}
                  />
                ))}
              </div>

              {/* Общее хранилище клиента — отдельно и ниже: это файлы, которые
                  приложили в карточках сделок (счета, макеты, медиапланы).
                  Раньше этот блок стоял первым и спорил с самими документами. */}
              <div className="mt-6 rounded-2xl border border-ink-800 bg-ink-900/30 p-4">
                <div className="text-sm font-semibold text-ink-200">Файлы из карточек сделок</div>
                <p className="mb-2.5 mt-0.5 text-xs text-ink-500">
                  Сюда попадает всё, что прикрепили в сделках и счетах. Версий здесь нет — это
                  простое хранилище.
                </p>
                <FileCell
                  ownerType="advertiser"
                  ownerId={selected.id}
                  kind="Документ"
                  advertiserId={selected.id}
                  label="Прикрепить файл с компьютера"
                  compact
                />
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

/** Время последней версии документа — по нему сортируем корзину. */
function versionTime(doc: Doc): number {
  const v = doc.versions[0];
  return v ? new Date(v.createdAt).getTime() : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Корзина раздела. Пустая — тихая пунктирная карточка с подписью, что сюда
// кладут. С документами — список, свежий сверху.
// ─────────────────────────────────────────────────────────────────────────────
function SectionBasket({
  sectionKey,
  types,
  docs,
  advertiserId,
  deals,
  onAdd,
  onUploadVersion,
}: {
  sectionKey: string;
  types: readonly string[];
  docs: Doc[];
  advertiserId: string;
  deals: DealOpt[];
  onAdd: () => void;
  onUploadVersion: (doc: Doc) => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const empty = docs.length === 0;

  // Файл, брошенный в корзину: заводим карточку документа и кладём файл первой
  // версией. Это ровно то, что человек делал двумя окнами и четырьмя полями.
  async function dropFiles(list: FileList | File[] | null) {
    const files = list ? Array.from(list) : [];
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of files) {
        const title = file.name.replace(/\.[^.]+$/, "").slice(0, 120) || file.name;
        const doc = await apiFetch<{ id: string }>("/api/documents", {
          method: "POST",
          body: JSON.stringify({ advertiserId, type: types[0], title }),
        });
        const fd = new FormData();
        fd.append("file", file);
        fd.append("changeNote", "загружен перетаскиванием");
        await apiFetch(`/api/documents/${doc.id}/versions`, { method: "POST", body: fd });
      }
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        dropFiles(e.dataTransfer.files);
      }}
      className={`flex flex-col rounded-2xl border p-4 transition ${
        dragOver
          ? "border-brand bg-brand/10"
          : empty
            ? "border-dashed border-ink-700/70 bg-ink-900/20"
            : "border-ink-700 bg-ink-850"
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-ink-100">{sectionKey}</div>
          <div className="mt-0.5 truncate text-xs text-ink-500" title={types.join(", ")}>
            {docs.length > 0
              ? `${docs.length} ${plural(docs.length, "документ", "документа", "документов")}`
              : types.join(", ")}
          </div>
        </div>
        <button
          type="button"
          onClick={onAdd}
          title="Завести карточку документа без файла"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-500 transition hover:bg-ink-800 hover:text-brand"
        >
          <Plus size={16} />
        </button>
      </div>

      {docs.length > 0 && (
        <div className="mb-3 space-y-2">
          {docs.map((doc) => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              deals={deals}
              onUpload={() => onUploadVersion(doc)}
            />
          ))}
        </div>
      )}

      {/* Зона загрузки. У пустой корзины она и есть всё содержимое — крупная и
          спокойная; у заполненной — тонкая строка внизу. */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className={`mt-auto flex w-full items-center justify-center gap-2 rounded-xl border border-dashed text-sm transition ${
          dragOver ? "border-brand text-brand" : "border-ink-700 text-ink-500 hover:border-brand/40 hover:text-brand-200"
        } ${empty ? "py-8" : "py-2.5"}`}
      >
        <Upload size={15} />
        {busy ? "Загружаю…" : empty ? "Перетащите файл сюда или нажмите" : "Добавить файл"}
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        onChange={(e) => dropFiles(e.target.files)}
      />
      {error && <div className="mt-2 text-xs text-red-300">{error}</div>}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Строка документа внутри корзины: название, свежая версия с датой, история.
// ⚠️ Дата и пометка «свежая» стоят на виду специально — по просьбе
// пользователя: в версиях легко потеряться, если не видно, какая последняя.
// ─────────────────────────────────────────────────────────────────────────────
function DocumentRow({
  doc,
  deals,
  onUpload,
}: {
  doc: Doc;
  deals: DealOpt[];
  onUpload: () => void;
}) {
  const [open, setOpen] = useState(false);
  const current = doc.versions[0];
  const older = doc.versions.slice(1);

  return (
    <div className="rounded-xl border border-ink-800 bg-ink-900/50">
      {/* ⚠️ Название и действия стоят в РАЗНЫХ строках. Когда они были в одной,
          кнопки съедали ширину узкой колонки и название документа исчезало
          совсем — ровно то, за чем сюда и приходят. */}
      <div className="p-3">
        <div className="flex items-start gap-2">
          <FileText size={15} className="mt-0.5 shrink-0 text-brand/70" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-ink-100" title={doc.title}>
              {doc.title}
            </div>
            {current ? (
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <span className="rounded-md bg-brand/15 px-1.5 py-0.5 font-semibold text-brand">
                  v{current.versionNo} · свежая
                </span>
                <span className="text-ink-400">{formatDate(current.createdAt)}</span>
                <span className="w-full truncate text-ink-500" title={current.fileName}>
                  {current.fileName} · {formatBytes(current.sizeBytes)}
                </span>
              </div>
            ) : (
              <div className="mt-0.5 text-xs text-ink-500">файла ещё нет — перетащите сюда</div>
            )}
          </div>
        </div>

        <div className="mt-2 flex items-center gap-0.5">
          {current && (
            <a
              href={`/api/versions/${current.id}/download`}
              className="btn btn-ghost btn-sm mr-auto"
              title="Скачать свежую версию"
            >
              <Download size={15} /> Скачать
            </a>
          )}
          <button
            onClick={onUpload}
            title="Загрузить новую версию — прежняя останется в истории"
            className={`flex h-9 w-9 items-center justify-center rounded-lg text-ink-400 transition hover:bg-ink-800 hover:text-brand ${
              current ? "" : "mr-auto"
            }`}
          >
            <Upload size={16} />
          </button>
          <EditDocumentButton doc={doc} deals={deals} iconOnly />
          <DeleteButton endpoint={`/api/documents/${doc.id}`} what={`документ «${doc.title}»`} />
        </div>
      </div>

      {/* Файлы-спутники одной карточки (два приложения к одному договору,
          ресайзы макета) — они не версии друг друга. */}
      <div className="border-t border-ink-800/80 px-3 pb-2 pt-2">
        <FileCell
          ownerType="document"
          ownerId={doc.id}
          kind={doc.type}
          dealId={doc.dealId ?? undefined}
          label="Файлы рядом"
          compact
        />
      </div>

      {older.length > 0 && (
        <div className="border-t border-ink-800/80">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-2 text-xs text-ink-500 transition hover:text-ink-200"
          >
            <span>
              История: ещё {older.length} {plural(older.length, "версия", "версии", "версий")}
            </span>
            <span>{open ? "▲" : "▼"}</span>
          </button>
          {open && (
            <div className="divide-y divide-ink-800/70 border-t border-ink-800/70">
              {older.map((v) => (
                <div key={v.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-ink-800 px-1.5 py-0.5 text-[11px] font-semibold text-ink-300">
                        v{v.versionNo}
                      </span>
                      <span className="truncate text-xs text-ink-300">{v.fileName}</span>
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-ink-500">
                      {v.changeNote ? `${v.changeNote} · ` : ""}
                      {formatDateTime(v.createdAt)}
                      {v.uploadedBy ? ` · ${v.uploadedBy.name}` : ""}
                    </div>
                  </div>
                  <a
                    href={`/api/versions/${v.id}/download`}
                    title="Скачать эту версию"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-500 transition hover:bg-ink-800 hover:text-brand"
                  >
                    <Download size={15} />
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
    <Modal
      open={open}
      onClose={onClose}
      title="Карточка документа"
      subtitle={`${advertiserName} · файл можно приложить позже`}
      size="sm"
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Корзина</label>
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
          Если файл уже есть — проще перетащить его прямо в корзину: карточка создастся сама.
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
      title="Новая версия"
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
