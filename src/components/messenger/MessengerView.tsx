"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pin, PinOff, Paperclip, Send, Trash2, Plus, X, Search, MessageSquarePlus } from "lucide-react";
import { Modal, FormError } from "@/components/ui/Modal";
import { apiFetch } from "@/lib/client";
import { formatBytes, initials } from "@/lib/format";

type Channel = { id: string; name: string; description: string | null; isGeneral: boolean; isDm: boolean };
type UserLite = { id: string; name: string };
type Attachment = { id: string; fileName: string; sizeBytes: number; contentType: string | null };
type Msg = {
  id: string;
  body: string;
  pinned: boolean;
  createdAt: string;
  editedAt: string | null;
  contextType: string | null;
  contextId: string | null;
  contextLabel: string | null;
  author: { id: string; name: string };
  attachments: Attachment[];
};
type Me = { id: string; name: string; role: string };
type Adv = { id: string; nameRu: string };
type DealOpt = { id: string; title: string };

// ─────────────────────────────────────────────────────────────────────────────
// Внутренний чат в привычной логике мессенджера: слева список диалогов
// с превью последнего сообщения, справа лента «пузырями» с разделителями дат.
// Enter отправляет, Shift+Enter — перенос строки.
// ─────────────────────────────────────────────────────────────────────────────

const DAY = 86_400_000;

function timeHM(iso: string) {
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(today) - startOf(d)) / DAY);
  if (diff === 0) return "Сегодня";
  if (diff === 1) return "Вчера";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", ...(d.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}) });
}

/** Стабильный цвет аватарки по имени — чтобы собеседники различались взглядом. */
function avatarTone(name: string) {
  const tones = [
    "bg-brand/20 text-brand-200",
    "bg-sky-500/20 text-sky-200",
    "bg-emerald-500/20 text-emerald-200",
    "bg-violet-500/20 text-violet-200",
    "bg-amber-500/20 text-amber-200",
    "bg-rose-500/20 text-rose-200",
  ];
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return tones[h % tones.length];
}

export function MessengerView({
  me,
  channels: initialChannels,
  users,
  advertisers,
  deals,
}: {
  me: Me;
  channels: Channel[];
  users: UserLite[];
  advertisers: Adv[];
  deals: DealOpt[];
}) {
  const [channels, setChannels] = useState(initialChannels);
  const [activeId, setActiveId] = useState(initialChannels[0]?.id ?? "");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [newChannelOpen, setNewChannelOpen] = useState(false);
  const [dmOpen, setDmOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [showPinned, setShowPinned] = useState(false);
  // Превью последнего сообщения в списке диалогов.
  const [previews, setPreviews] = useState<Record<string, { text: string; at: string }>>({});

  const active = channels.find((c) => c.id === activeId) ?? null;

  const reload = useCallback(async () => {
    if (!activeId) return;
    try {
      const m = await apiFetch<Msg[]>(`/api/chat/channels/${activeId}/messages`);
      setMessages(m);
      const last = m[m.length - 1];
      if (last) {
        setPreviews((p) => ({
          ...p,
          [activeId]: {
            text: last.body || (last.attachments.length ? "📎 файл" : ""),
            at: last.createdAt,
          },
        }));
      }
    } catch {
      /* тихо: сеть/поллинг */
    } finally {
      setLoading(false);
    }
  }, [activeId]);

  const activeIdRef = useRef(activeId);
  const reloadRef = useRef(reload);
  activeIdRef.current = activeId;
  reloadRef.current = reload;

  // Мгновенный realtime: сервер шлёт channelId нового сообщения.
  useEffect(() => {
    const es = new EventSource("/api/chat/stream");
    es.addEventListener("message", (e) => {
      if ((e as MessageEvent).data === activeIdRef.current) reloadRef.current();
    });
    return () => es.close();
  }, []);

  useEffect(() => {
    setLoading(true);
    reload();
    // Каждые 4 секунды: SSE может не дойти через прокси, поллинг — надёжная страховка.
    const t = setInterval(reload, 4000);
    return () => clearInterval(t);
  }, [reload]);

  async function startDm(userId: string) {
    const c = await apiFetch<{ id: string; name: string }>("/api/chat/dm", { method: "POST", body: JSON.stringify({ userId }) });
    setChannels((cs) => (cs.some((x) => x.id === c.id) ? cs : [...cs, { id: c.id, name: c.name, description: null, isGeneral: false, isDm: true }]));
    setActiveId(c.id);
    setDmOpen(false);
  }

  const pinned = useMemo(() => messages.filter((m) => m.pinned), [messages]);

  async function createChannel(name: string, description: string) {
    const c = await apiFetch<Channel>("/api/chat/channels", {
      method: "POST",
      body: JSON.stringify({ name, description: description || undefined }),
    });
    setChannels((cs) => [...cs, { ...c }]);
    setActiveId(c.id);
  }

  async function deleteChannel(id: string) {
    await apiFetch(`/api/chat/channels/${id}`, { method: "DELETE" });
    setChannels((cs) => cs.filter((c) => c.id !== id));
    setActiveId((cur) => (cur === id ? channels[0]?.id ?? "" : cur));
  }

  const visibleChannels = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? channels.filter((c) => c.name.toLowerCase().includes(q)) : channels;
  }, [channels, query]);

  const groups = channels.some((c) => c.isDm)
    ? [
        { title: "Каналы", items: visibleChannels.filter((c) => !c.isDm), add: () => setNewChannelOpen(true), addTitle: "Новый канал" },
        { title: "Личные сообщения", items: visibleChannels.filter((c) => c.isDm), add: () => setDmOpen(true), addTitle: "Написать сотруднику" },
      ]
    : [
        { title: "Каналы", items: visibleChannels.filter((c) => !c.isDm), add: () => setNewChannelOpen(true), addTitle: "Новый канал" },
        { title: "Личные сообщения", items: [], add: () => setDmOpen(true), addTitle: "Написать сотруднику" },
      ];

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold uppercase tracking-wide text-ink-50">Мессенджер</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setDmOpen(true)}>
          <MessageSquarePlus size={15} /> Написать сотруднику
        </button>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[290px_1fr]">
        {/* ── Список диалогов ───────────────────────────────────────────── */}
        <aside className="card flex min-h-0 flex-col overflow-hidden p-0">
          <div className="border-b border-ink-800 p-3">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
              <input
                className="input h-9 pl-8 text-sm"
                placeholder="Поиск по чатам"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {groups.map((g) => (
              <div key={g.title} className="mb-3">
                <div className="mb-1 flex items-center justify-between px-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">{g.title}</span>
                  <button className="btn-icon h-6 w-6 border-0 bg-transparent text-ink-500 hover:text-brand" title={g.addTitle} onClick={g.add}>
                    <Plus size={14} />
                  </button>
                </div>
                {g.items.length === 0 && <div className="px-3 py-1 text-xs text-ink-600">пусто</div>}
                {g.items.map((c) => {
                  const p = previews[c.id];
                  const activeChat = c.id === activeId;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setActiveId(c.id)}
                      className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition ${
                        activeChat ? "bg-brand/12 ring-1 ring-inset ring-brand/25" : "hover:bg-ink-800/60"
                      }`}
                    >
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                          c.isDm ? avatarTone(c.name) : "bg-ink-700 text-ink-200"
                        }`}
                      >
                        {c.isDm ? initials(c.name) : "#"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className={`truncate text-sm ${activeChat ? "font-semibold text-brand-200" : "font-medium text-ink-100"}`}>
                            {c.name}
                          </span>
                          {p && <span className="shrink-0 text-[10px] text-ink-600">{timeHM(p.at)}</span>}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-ink-500">
                          {p?.text || (c.isDm ? "личный диалог" : c.description || "нет сообщений")}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </aside>

        {/* ── Лента ─────────────────────────────────────────────────────── */}
        <section className="card flex min-h-0 flex-col overflow-hidden p-0">
          {active ? (
            <>
              <header className="flex items-center justify-between gap-3 border-b border-ink-800 px-4 py-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      active.isDm ? avatarTone(active.name) : "bg-ink-700 text-ink-200"
                    }`}
                  >
                    {active.isDm ? initials(active.name) : "#"}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-ink-50">{active.name}</div>
                    <div className="truncate text-xs text-ink-500">
                      {active.isDm ? "личный диалог" : active.description || "канал команды"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {pinned.length > 0 && (
                    <button
                      className={`btn-icon h-8 w-8 ${showPinned ? "border-brand/40 text-brand" : "text-ink-400 hover:text-brand"}`}
                      title="Закреплённые сообщения"
                      onClick={() => setShowPinned((v) => !v)}
                    >
                      <Pin size={15} />
                    </button>
                  )}
                  {!active.isGeneral && !active.isDm && (
                    <button
                      className="btn-icon h-8 w-8 border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                      title="Удалить канал"
                      onClick={() => {
                        if (confirm(`Удалить канал «${active.name}» со всеми сообщениями?`)) deleteChannel(active.id);
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </header>

              {showPinned && pinned.length > 0 && (
                <div className="animate-lift border-b border-ink-800 bg-brand/[0.05] px-4 py-3">
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand-200">
                    <Pin size={13} /> Закреплённые ({pinned.length})
                  </div>
                  <div className="space-y-1.5">
                    {pinned.map((m) => (
                      <div key={m.id} className="rounded-lg bg-ink-900/60 px-3 py-2 text-sm">
                        <div className="text-xs text-ink-500">{m.author.name.split(" ")[0]}</div>
                        <div className="whitespace-pre-wrap text-ink-200">{m.body}</div>
                        <AttachmentList attachments={m.attachments} compact />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <MessageList messages={messages} me={me} loading={loading} isDm={active.isDm} onChanged={reload} />

              <Composer channelId={active.id} advertisers={advertisers} deals={deals} onSent={reload} />
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-ink-500">Выберите чат слева или создайте новый</div>
          )}
        </section>
      </div>

      <NewChannelModal open={newChannelOpen} onClose={() => setNewChannelOpen(false)} onCreate={createChannel} />

      <Modal open={dmOpen} onClose={() => setDmOpen(false)} title="Написать сотруднику">
        <div className="space-y-1.5">
          {users.length === 0 && <p className="text-sm text-ink-400">Других сотрудников пока нет.</p>}
          {users.map((u) => (
            <button
              key={u.id}
              onClick={() => startDm(u.id)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-ink-200 transition hover:bg-ink-800/60"
            >
              <span className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ${avatarTone(u.name)}`}>
                {initials(u.name)}
              </span>
              {u.name}
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}

function MessageList({
  messages,
  me,
  loading,
  isDm,
  onChanged,
}: {
  messages: Msg[];
  me: Me;
  loading: boolean;
  isDm: boolean;
  onChanged: () => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const lastId = messages[messages.length - 1]?.id;
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lastId]);

  async function togglePin(m: Msg) {
    await apiFetch(`/api/chat/messages/${m.id}`, { method: "PATCH", body: JSON.stringify({ pinned: !m.pinned }) });
    onChanged();
  }
  async function remove(m: Msg) {
    if (!confirm("Удалить сообщение?")) return;
    await apiFetch(`/api/chat/messages/${m.id}`, { method: "DELETE" });
    onChanged();
  }

  if (loading && messages.length === 0) {
    return <div className="flex flex-1 items-center justify-center text-sm text-ink-500">Загрузка…</div>;
  }
  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center">
        <div className="text-3xl opacity-70">💬</div>
        <div className="text-sm text-ink-400">Сообщений пока нет</div>
        <div className="text-xs text-ink-600">Напишите первое — оно появится у всех мгновенно</div>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
      {messages.map((m, i) => {
        const mine = m.author.id === me.id;
        const canDelete = mine || me.role === "Owner";
        const prev = messages[i - 1];
        const newDay = !prev || dayLabel(prev.createdAt) !== dayLabel(m.createdAt);
        // Подряд идущие сообщения одного автора склеиваем: без повторной подписи.
        const grouped =
          !newDay &&
          prev &&
          prev.author.id === m.author.id &&
          new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60_000;

        return (
          <div key={m.id}>
            {newDay && (
              <div className="my-3 flex items-center justify-center">
                <span className="rounded-full bg-ink-800/80 px-3 py-1 text-[11px] font-medium text-ink-400">
                  {dayLabel(m.createdAt)}
                </span>
              </div>
            )}

            <div className={`group flex gap-2 ${mine ? "flex-row-reverse" : ""} ${grouped ? "mt-0.5" : "mt-3"}`}>
              {/* аватар только у первого сообщения в серии */}
              <div className="w-8 shrink-0">
                {!grouped && !mine && (
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold ${avatarTone(m.author.name)}`}
                  >
                    {initials(m.author.name)}
                  </span>
                )}
              </div>

              <div className={`flex max-w-[76%] flex-col ${mine ? "items-end" : "items-start"}`}>
                {!grouped && !mine && !isDm && (
                  <span className="mb-0.5 px-1 text-xs font-semibold text-ink-300">{m.author.name.split(" ")[0]}</span>
                )}

                <div
                  className={`relative rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                    mine
                      ? "rounded-br-md bg-brand/18 text-ink-50 ring-1 ring-inset ring-brand/25"
                      : "rounded-bl-md bg-ink-800/90 text-ink-100 ring-1 ring-inset ring-ink-700/70"
                  }`}
                >
                  {m.contextLabel && (
                    <span className="mb-1 inline-flex items-center gap-1 rounded bg-ink-900/60 px-1.5 py-0.5 text-[11px] text-ink-300 ring-1 ring-inset ring-ink-700">
                      {m.contextType === "deal" ? "⑂" : "☰"} {m.contextLabel}
                    </span>
                  )}
                  {m.body && <div className="whitespace-pre-wrap break-words">{m.body}</div>}
                  <AttachmentList attachments={m.attachments} />
                  <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-ink-500">
                    {m.pinned && <Pin size={10} className="text-brand-200" />}
                    {timeHM(m.createdAt)}
                  </div>
                </div>

                {/* действия появляются при наведении */}
                <div className={`mt-0.5 flex gap-0.5 opacity-0 transition group-hover:opacity-100 ${mine ? "flex-row-reverse" : ""}`}>
                  <button
                    className="rounded-md px-1.5 py-0.5 text-[11px] text-ink-500 hover:text-brand"
                    title={m.pinned ? "Открепить" : "Закрепить"}
                    onClick={() => togglePin(m)}
                  >
                    {m.pinned ? <PinOff size={12} /> : <Pin size={12} />}
                  </button>
                  {canDelete && (
                    <button
                      className="rounded-md px-1.5 py-0.5 text-[11px] text-ink-500 hover:text-red-400"
                      title="Удалить"
                      onClick={() => remove(m)}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}

function AttachmentList({ attachments, compact }: { attachments: Attachment[]; compact?: boolean }) {
  if (attachments.length === 0) return null;
  return (
    <div className={`flex flex-wrap gap-1.5 ${compact ? "mt-1" : "mt-1.5"}`}>
      {attachments.map((a) => (
        <a
          key={a.id}
          href={`/api/chat/attachments/${a.id}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-ink-900/70 px-2 py-1 text-xs text-ink-200 ring-1 ring-inset ring-ink-700 transition hover:text-brand-200"
        >
          <Paperclip size={12} />
          <span className="max-w-[170px] truncate">{a.fileName}</span>
          <span className="text-ink-500">{formatBytes(a.sizeBytes)}</span>
        </a>
      ))}
    </div>
  );
}

function Composer({ channelId, advertisers, deals, onSent }: { channelId: string; advertisers: Adv[]; deals: DealOpt[]; onSent: () => void }) {
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [ctx, setCtx] = useState(""); // "advertiser:<id>" | "deal:<id>" | ""
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Поле растёт под текст, как в мессенджерах.
  function autoGrow() {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }

  async function send() {
    if (!body.trim() && files.length === 0) return;
    setSending(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("body", body.trim());
      if (ctx) {
        const [type, id] = ctx.split(":");
        const label = type === "deal" ? deals.find((d) => d.id === id)?.title : advertisers.find((a) => a.id === id)?.nameRu;
        fd.append("contextType", type);
        fd.append("contextId", id);
        fd.append("contextLabel", label ?? "");
      }
      for (const f of files) fd.append("files", f);
      await apiFetch(`/api/chat/channels/${channelId}/messages`, { method: "POST", body: fd });
      setBody("");
      setFiles([]);
      setCtx("");
      if (fileRef.current) fileRef.current.value = "";
      if (taRef.current) taRef.current.style.height = "auto";
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить");
    } finally {
      setSending(false);
    }
  }

  // Enter — отправить, Shift+Enter — новая строка (как в Telegram).
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="border-t border-ink-800 px-3 py-2.5">
      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {files.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 rounded-lg bg-ink-800 px-2 py-1 text-xs text-ink-200">
              <Paperclip size={11} /> <span className="max-w-[160px] truncate">{f.name}</span>
              <button onClick={() => setFiles((fs) => fs.filter((_, j) => j !== i))} className="text-ink-500 hover:text-red-400">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {ctx && (
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-lg bg-brand/10 px-2 py-1 text-xs text-brand-200 ring-1 ring-inset ring-brand/25">
          🔗 {ctx.startsWith("deal") ? deals.find((d) => `deal:${d.id}` === ctx)?.title : advertisers.find((a) => `advertiser:${a.id}` === ctx)?.nameRu}
          <button onClick={() => setCtx("")} className="text-brand-200/70 hover:text-red-300">
            <X size={11} />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2 rounded-2xl border border-ink-700 bg-ink-900/70 px-2 py-1.5 focus-within:border-brand/50">
        <button
          type="button"
          className="btn-icon h-8 w-8 shrink-0 border-0 bg-transparent text-ink-400 hover:text-brand"
          title="Прикрепить файл"
          onClick={() => fileRef.current?.click()}
        >
          <Paperclip size={17} />
        </button>
        <input ref={fileRef} type="file" multiple hidden onChange={(e) => setFiles((fs) => [...fs, ...Array.from(e.target.files ?? [])])} />

        {(advertisers.length > 0 || deals.length > 0) && (
          <select
            className="h-8 w-8 shrink-0 appearance-none rounded-lg border-0 bg-transparent text-center text-base text-ink-400 outline-none hover:text-brand-200"
            value={ctx}
            onChange={(e) => setCtx(e.target.value)}
            title="Привязать сообщение к клиенту или сделке"
          >
            <option value="">🔗</option>
            {advertisers.length > 0 && (
              <optgroup label="Клиенты">
                {advertisers.map((a) => (
                  <option key={a.id} value={`advertiser:${a.id}`} className="bg-ink-850">
                    {a.nameRu}
                  </option>
                ))}
              </optgroup>
            )}
            {deals.length > 0 && (
              <optgroup label="Сделки">
                {deals.map((d) => (
                  <option key={d.id} value={`deal:${d.id}`} className="bg-ink-850">
                    {d.title}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        )}

        <textarea
          ref={taRef}
          className="max-h-40 min-h-[32px] flex-1 resize-none border-0 bg-transparent py-1.5 text-sm text-ink-100 outline-none placeholder:text-ink-500"
          rows={1}
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            autoGrow();
          }}
          onKeyDown={onKeyDown}
          placeholder="Написать сообщение…"
        />

        <button
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition ${
            body.trim() || files.length ? "bg-brand text-ink-950 hover:brightness-110" : "bg-ink-800 text-ink-600"
          }`}
          disabled={sending || (!body.trim() && files.length === 0)}
          onClick={send}
          title="Отправить (Enter)"
        >
          <Send size={16} />
        </button>
      </div>
      <FormError message={error} />
    </div>
  );
}

function NewChannelModal({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (name: string, desc: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onCreate(name.trim(), desc.trim());
      setName("");
      setDesc("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Новый канал">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Название *</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required autoFocus placeholder="напр. Т-Банк" />
        </div>
        <div>
          <label className="label">Описание</label>
          <input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="о чём канал" />
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
