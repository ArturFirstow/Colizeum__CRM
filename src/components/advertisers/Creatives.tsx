"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client";
import { FileCell } from "@/components/ui/FileCell";
import { DeleteButton } from "@/components/ui/DeleteButton";

const CREATIVE_STATUSES = ["В работе", "На согласовании", "Согласован", "Отклонён"] as const;

const STATUS_STYLE: Record<string, string> = {
  "В работе": "border-sky-500/30 bg-sky-500/10 text-sky-200",
  "На согласовании": "border-amber-500/30 bg-amber-500/10 text-amber-200",
  Согласован: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  Отклонён: "border-red-500/30 bg-red-500/10 text-red-200",
};

type Creative = {
  id: string;
  title: string;
  size: string | null;
  linkUrl: string | null;
  status: string;
  notes: string | null;
};

// Блок «Креативы» карточки клиента (v2, п.1.3): макеты со статусами согласования.
export function Creatives({ advertiserId, creatives }: { advertiserId: string; creatives: Creative[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [size, setSize] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [saving, setSaving] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch(`/api/advertisers/${advertiserId}/creatives`, {
        method: "POST",
        body: JSON.stringify({ title, size: size || undefined, linkUrl: linkUrl || undefined }),
      });
      setTitle("");
      setSize("");
      setAdding(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(id: string, status: string) {
    await apiFetch(`/api/creatives/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    router.refresh();
  }

  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-ink-50">Креативы</h2>
        <button className="btn btn-ghost btn-sm" onClick={() => setAdding((v) => !v)}>
          {adding ? "Отмена" : "+ Макет"}
        </button>
      </div>

      {adding && (
        <form onSubmit={add} className="mb-4 flex flex-col gap-2 rounded-xl border border-ink-700 bg-ink-900/60 p-3 sm:flex-row">
          <input
            className="input flex-1"
            placeholder="Название макета *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
          />
          <input
            className="input sm:w-40"
            placeholder="Размер (1080×372)"
            value={size}
            onChange={(e) => setSize(e.target.value)}
          />
          <input
            className="input sm:w-56"
            placeholder="Ссылка на макет"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            title="Google Drive, Figma, облако — всё, где лежит актуальный макет"
          />
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "…" : "Добавить"}
          </button>
        </form>
      )}

      {/* Файлы макетов — можно просто перетащить сюда с компьютера */}
      <div className="mb-3">
        <FileCell
          ownerType="advertiser"
          ownerId={advertiserId}
          kind="Креатив"
          advertiserId={advertiserId}
          label="Прикрепить макет (jpg, png, pdf)"
        />
      </div>

      {creatives.length === 0 ? (
        <p className="text-sm text-ink-400">Карточек макетов пока нет — файлы можно приложить выше.</p>
      ) : (
        <div className="space-y-2">
          {creatives.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-ink-800 bg-ink-900/50 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-ink-100">{c.title}</div>
                <div className="mt-0.5 text-xs text-ink-500">
                  {c.size ?? "размер не указан"}
                  {c.notes ? ` · ${c.notes}` : ""}
                </div>
                {/* Ссылка на макет: дизайнеры держат исходники в Drive и Figma,
                    копия в сервисе устаревает в тот же день (просьба И-4). */}
                <CreativeLink id={c.id} value={c.linkUrl} />
              </div>
              <select
                className={`rounded-lg border px-2 py-1 text-xs font-medium ${STATUS_STYLE[c.status] ?? "border-ink-700 bg-ink-800 text-ink-200"}`}
                value={c.status}
                onChange={(e) => setStatus(c.id, e.target.value)}
              >
                {CREATIVE_STATUSES.map((s) => (
                  <option key={s} value={s} className="bg-ink-900 text-ink-100">
                    {s}
                  </option>
                ))}
              </select>
              <DeleteButton endpoint={`/api/creatives/${c.id}`} what={`макет «${c.title}»`} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Ссылка на макет (просьба коллег И-4).
//
// Почему ссылка, а не только файл: исходники живут в Google Drive и Figma, и
// копия, загруженная в сервис, устаревает в тот же день, когда дизайнер
// поправил макет. Ссылка всегда ведёт на действующую версию.
//
// Файлы при этом никуда не делись — они нужны там, где важно зафиксировать
// именно ТУ картинку, которую согласовали (маркировка, акты).
// ─────────────────────────────────────────────────────────────────────────────
function CreativeLink({ id, value }: { id: string; value: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await apiFetch(`/api/creatives/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ linkUrl: draft.trim() }),
      });
      setEditing(false);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Не удалось сохранить ссылку");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="mt-1.5 flex items-center gap-1.5">
        <input
          className="input h-7 flex-1 text-xs"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="https://… — Drive, Figma, облако"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
        />
        <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
          {saving ? "…" : "ОК"}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => { setDraft(value ?? ""); setEditing(false); }}>
          Отмена
        </button>
      </div>
    );
  }

  if (!value) {
    return (
      <button
        className="mt-1 text-xs text-ink-500 underline underline-offset-2 transition hover:text-brand"
        onClick={() => setEditing(true)}
      >
        + ссылка на макет
      </button>
    );
  }

  return (
    <div className="mt-1 flex min-w-0 items-center gap-2">
      <a
        href={value}
        target="_blank"
        rel="noreferrer"
        className="min-w-0 truncate text-xs text-brand underline underline-offset-2"
        title={value}
      >
        🔗 {value.replace(/^https?:\/\//, "")}
      </a>
      <button
        className="shrink-0 text-xs text-ink-600 transition hover:text-ink-300"
        onClick={() => setEditing(true)}
        title="Изменить ссылку"
      >
        ✎
      </button>
    </div>
  );
}
