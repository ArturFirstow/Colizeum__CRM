"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, FormError } from "@/components/ui/Modal";
import { apiFetch } from "@/lib/client";
import { KNOWLEDGE_CATEGORIES } from "@/lib/enums";
import { KnowledgeFiles, type KFile } from "@/components/knowledge/KnowledgeFiles";
import { FileCell } from "@/components/ui/FileCell";
import { formatDate } from "@/lib/format";

type Article = {
  id: string;
  category: string;
  title: string;
  htmlBody: string;
  bodyMarkdown: string;
  notes: string | null;
  updatedAt: string | Date;
};

export function KnowledgeView({ articles, files = [] }: { articles: Article[]; files?: KFile[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string>(articles[0]?.id ?? "");
  const [editing, setEditing] = useState<Article | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return articles.filter((a) => {
      if (cat && a.category !== cat) return false;
      if (!query) return true;
      return (
        a.title.toLowerCase().includes(query) ||
        a.bodyMarkdown.toLowerCase().includes(query) ||
        a.category.toLowerCase().includes(query)
      );
    });
  }, [articles, q, cat]);

  const selected = filtered.find((a) => a.id === selectedId) ?? filtered[0];
  const categories = useMemo(() => [...new Set(articles.map((a) => a.category))], [articles]);
  const clientMaterials = useMemo(
    () => articles.filter((a) => a.category === "Материалы для клиента"),
    [articles],
  );

  function openArticle(id: string, category: string) {
    setCat(category);
    setQ("");
    setSelectedId(id);
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-ink-700 bg-ink-800/60 text-xl">
            ◈
          </div>
          <div>
            <h1 className="text-2xl font-bold text-ink-50">База знаний</h1>
            <p className="mt-0.5 text-sm text-ink-300">Как у нас всё устроено: форматы, цены, ОРД, промокоды, кейсы</p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          + Статья
        </button>
      </div>

      {/* Рабочие файлы: скачать договор, прайс, презентацию */}
      {!q && cat === "" && (
        <div className="mb-6">
          <KnowledgeFiles files={files} />
        </div>
      )}

      {/* Материалы, которые отправляются рекламодателю — на видном месте */}
      {clientMaterials.length > 0 && !q && cat === "" && (
        <section className="mb-6 rounded-2xl border border-brand/25 bg-brand/[0.05] p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-lg">📮</span>
            <h2 className="font-display text-base font-semibold uppercase tracking-wide text-brand-200">
              Материалы для клиента
            </h2>
            <span className="text-xs text-ink-400">— отправляем рекламодателю</span>
          </div>
          {/* В каждой ячейке — свои файлы: медиакит, исследование, техтребования.
              Файл можно заменить прямо здесь, когда придёт новая версия. */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {clientMaterials.map((m) => (
              <div key={m.id} className="rounded-xl border border-ink-700/70 bg-ink-900/60 p-3.5">
                <button onClick={() => openArticle(m.id, m.category)} className="block w-full text-left">
                  <div className="text-sm font-semibold text-ink-100 hover:text-brand">{m.title}</div>
                  {m.notes && <div className="mt-0.5 truncate text-xs text-ink-500">{m.notes}</div>}
                </button>
                <div className="mt-2.5">
                  <FileCell ownerType="knowledge" ownerId={m.id} kind="Материал" label="Загрузить файл" compact />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <input
        className="input mb-4"
        placeholder="Поиск: промокод, ЕРИД, CTR, имя коллеги…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <div className="mb-5 flex flex-wrap gap-2">
        <Chip active={cat === ""} onClick={() => setCat("")}>
          Все
        </Chip>
        {categories.map((c) => (
          <Chip key={c} active={cat === c} onClick={() => setCat(c)}>
            {c}
          </Chip>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <div className="card max-h-[70vh] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="p-4 text-sm text-ink-400">Ничего не найдено</p>
          ) : (
            filtered.map((a) => (
              <button
                key={a.id}
                onClick={() => setSelectedId(a.id)}
                className={`w-full rounded-xl px-3 py-2.5 text-left transition ${
                  selected?.id === a.id ? "bg-ink-800" : "hover:bg-ink-800/60"
                }`}
              >
                <div className="text-[10px] font-semibold uppercase tracking-wide text-brand">{a.category}</div>
                <div className="mt-0.5 text-sm font-medium text-ink-100">{a.title}</div>
              </button>
            ))
          )}
        </div>

        <div>
          {selected ? (
            <article className="card p-6">
              <div className="mb-4 flex items-start justify-between gap-3 border-b border-ink-800 pb-4">
                <div>
                  <div className="badge badge-brand mb-2">{selected.category}</div>
                  <h2 className="text-xl font-bold text-ink-50">{selected.title}</h2>
                  <div className="mt-1 text-xs text-ink-500">Обновлено {formatDate(selected.updatedAt)}</div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditing(selected)}>
                  ✎ Править
                </button>
              </div>
              {selected.notes && selected.notes.includes("⚠️") && (
                <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-sm text-amber-100">
                  {selected.notes}
                </div>
              )}
              <div className="prose-kb" dangerouslySetInnerHTML={{ __html: selected.htmlBody }} />
            </article>
          ) : (
            <div className="card p-10 text-center text-ink-400">Выберите статью</div>
          )}
        </div>
      </div>

      <ArticleModal
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={() => router.refresh()}
      />
      {editing && (
        <ArticleModal
          open={!!editing}
          article={editing}
          onClose={() => setEditing(null)}
          onSaved={() => router.refresh()}
        />
      )}
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

function ArticleModal({
  open,
  article,
  onClose,
  onSaved,
}: {
  open: boolean;
  article?: Article;
  onClose: () => void;
  onSaved: () => void;
}) {
  const NEW_CATEGORY = "__new__";
  const [f, setF] = useState({
    category: article?.category ?? KNOWLEDGE_CATEGORIES[0],
    title: article?.title ?? "",
    bodyMarkdown: article?.bodyMarkdown ?? "",
    notes: article?.notes ?? "",
  });
  // Создание новой категории прямо из формы (ТЗ р.2, п.6).
  const [newCategory, setNewCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const knownCategories = [...KNOWLEDGE_CATEGORIES] as string[];
  if (article && !knownCategories.includes(article.category)) knownCategories.push(article.category);

  function set<K extends keyof typeof f>(k: K, v: string) {
    setF((s) => ({ ...s, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload = {
        ...f,
        category: f.category === NEW_CATEGORY ? newCategory.trim() : f.category,
      };
      if (!payload.category) throw new Error("Укажите название новой категории");
      if (article) {
        await apiFetch(`/api/knowledge/${article.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await apiFetch("/api/knowledge", { method: "POST", body: JSON.stringify(payload) });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={article ? "Редактировать статью" : "Новая статья"} size="lg">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Категория</label>
            <select className="input" value={f.category} onChange={(e) => set("category", e.target.value)}>
              {knownCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value={NEW_CATEGORY}>➕ Новая категория…</option>
            </select>
            {f.category === NEW_CATEGORY && (
              <input
                className="input mt-2"
                placeholder="Название новой категории"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                autoFocus
                required
              />
            )}
          </div>
          <div>
            <label className="label">Заголовок *</label>
            <input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} required />
          </div>
        </div>
        <div>
          <label className="label">Текст (Markdown, поддерживаются таблицы)</label>
          <textarea
            className="input min-h-[240px] font-mono text-xs"
            value={f.bodyMarkdown}
            onChange={(e) => set("bodyMarkdown", e.target.value)}
          />
        </div>
        <div>
          <label className="label">Заметки / флаги (⚠️)</label>
          <input className="input" value={f.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>
        <FormError message={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Сохранение…" : "Сохранить"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
