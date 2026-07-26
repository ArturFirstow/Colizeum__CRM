"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pin, PinOff, Paperclip, Send, Trash2, Plus, X } from "lucide-react";
import { Modal, FormError } from "@/components/ui/Modal";
import { apiFetch } from "@/lib/client";
import { formatDateTime, formatBytes, initials } from "@/lib/format";

type Channel = { id: string; name: string; description: string | null; isGeneral: boolean };
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

export function MessengerView({
  me,
  channels: initialChannels,
  advertisers,
  deals,
}: {
  me: Me;
  channels: Channel[];
  advertisers: Adv[];
  deals: DealOpt[];
}) {
  const [channels, setChannels] = useState(initialChannels);
  const [activeId, setActiveId] = useState(initialChannels[0]?.id ?? "");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [newChannelOpen, setNewChannelOpen] = useState(false);

  const active = channels.find((c) => c.id === activeId) ?? null;

  const reload = useCallback(async () => {
    if (!activeId) return;
    try {
      const m = await apiFetch<Msg[]>(`/api/chat/channels/${activeId}/messages`);
      setMessages(m);
    } catch {
      /* тихо: сеть/поллинг */
    } finally {
      setLoading(false);
    }
  }, [activeId]);

  // Поллинг ленты активного канала (~4 c) — «почти realtime».
  useEffect(() => {
    setLoading(true);
    reload();
    const t = setInterval(reload, 4000);
    return () => clearInterval(t);
  }, [reload]);

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

  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-ink-700 bg-ink-800/60 text-xl">✉</div>
        <div>
          <h1 className="font-display text-2xl font-semibold uppercase tracking-wide text-ink-50">Мессенджер</h1>
          <p className="mt-0.5 text-sm text-ink-300">Каналы команды · вложения · закреплённые сообщения</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        {/* Каналы */}
        <aside className="card h-max p-3">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">Каналы</span>
            <button className="btn-icon h-7 w-7 text-ink-300 hover:text-brand" title="Новый канал" onClick={() => setNewChannelOpen(true)}>
              <Plus size={15} />
            </button>
          </div>
          <div className="space-y-0.5">
            {channels.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                  c.id === activeId ? "bg-brand/15 font-semibold text-brand-200" : "text-ink-300 hover:bg-ink-800/60"
                }`}
              >
                <span className="text-ink-500">#</span>
                <span className="truncate">{c.name}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* Лента */}
        <section className="card flex min-h-[540px] flex-col p-0">
          {active ? (
            <>
              <header className="flex items-center justify-between gap-3 border-b border-ink-800 px-5 py-3">
                <div className="min-w-0">
                  <div className="font-semibold text-ink-50"># {active.name}</div>
                  {active.description && <div className="truncate text-xs text-ink-500">{active.description}</div>}
                </div>
                {!active.isGeneral && (
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
              </header>

              {/* Закреплённые */}
              {pinned.length > 0 && (
                <div className="border-b border-ink-800 bg-brand/[0.05] px-5 py-3">
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

              <MessageList messages={messages} me={me} loading={loading} onChanged={reload} />

              <Composer channelId={active.id} advertisers={advertisers} deals={deals} onSent={reload} />
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-ink-500">Выберите или создайте канал</div>
          )}
        </section>
      </div>

      <NewChannelModal open={newChannelOpen} onClose={() => setNewChannelOpen(false)} onCreate={createChannel} />
    </div>
  );
}

function MessageList({ messages, me, loading, onChanged }: { messages: Msg[]; me: Me; loading: boolean; onChanged: () => void }) {
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
    return <div className="flex flex-1 items-center justify-center text-sm text-ink-500">Сообщений пока нет. Напишите первое.</div>;
  }

  return (
    <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4" style={{ maxHeight: "52vh" }}>
      {messages.map((m) => {
        const mine = m.author.id === me.id;
        const canDelete = mine || me.role === "Owner";
        return (
          <div key={m.id} className="group flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-700 text-xs font-bold text-ink-100">
              {initials(m.author.name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-ink-100">{m.author.name.split(" ")[0]}</span>
                <span className="text-[11px] text-ink-600">{formatDateTime(m.createdAt)}</span>
                {m.pinned && <Pin size={12} className="text-brand-200" />}
                <span className="ml-auto flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                  <button className="btn-icon h-6 w-6 text-ink-400 hover:text-brand" title={m.pinned ? "Открепить" : "Закрепить"} onClick={() => togglePin(m)}>
                    {m.pinned ? <PinOff size={13} /> : <Pin size={13} />}
                  </button>
                  {canDelete && (
                    <button className="btn-icon h-6 w-6 text-ink-400 hover:text-red-400" title="Удалить" onClick={() => remove(m)}>
                      <Trash2 size={13} />
                    </button>
                  )}
                </span>
              </div>
              {m.contextLabel && (
                <span className="mt-0.5 inline-flex items-center gap-1 rounded bg-ink-800 px-1.5 py-0.5 text-[11px] text-ink-300 ring-1 ring-inset ring-ink-700">
                  {m.contextType === "deal" ? "⑂" : "☰"} {m.contextLabel}
                </span>
              )}
              <div className="mt-0.5 whitespace-pre-wrap break-words text-sm text-ink-200">{m.body}</div>
              <AttachmentList attachments={m.attachments} />
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
    <div className={`flex flex-wrap gap-2 ${compact ? "mt-1" : "mt-1.5"}`}>
      {attachments.map((a) => (
        <a
          key={a.id}
          href={`/api/chat/attachments/${a.id}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-ink-700 bg-ink-800/60 px-2.5 py-1 text-xs text-ink-200 transition hover:border-brand/40 hover:text-brand-200"
        >
          <Paperclip size={12} />
          <span className="max-w-[180px] truncate">{a.fileName}</span>
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
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить");
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="border-t border-ink-800 p-3">
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
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <textarea
            className="input min-h-[44px] resize-none"
            rows={2}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Сообщение… (Ctrl+Enter — отправить)"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-ink-700 bg-ink-800/60 px-2.5 py-1 text-xs text-ink-300 hover:text-brand-200"
              onClick={() => fileRef.current?.click()}
            >
              <Paperclip size={13} /> Файл
            </button>
            <input ref={fileRef} type="file" multiple hidden onChange={(e) => setFiles((fs) => [...fs, ...Array.from(e.target.files ?? [])])} />
            {(advertisers.length > 0 || deals.length > 0) && (
              <select className="rounded-lg border border-ink-700 bg-ink-900 px-2 py-1 text-xs text-ink-200" value={ctx} onChange={(e) => setCtx(e.target.value)}>
                <option value="">🔗 привязать к…</option>
                {advertisers.length > 0 && (
                  <optgroup label="Клиенты">
                    {advertisers.map((a) => (
                      <option key={a.id} value={`advertiser:${a.id}`}>{a.nameRu}</option>
                    ))}
                  </optgroup>
                )}
                {deals.length > 0 && (
                  <optgroup label="Сделки">
                    {deals.map((d) => (
                      <option key={d.id} value={`deal:${d.id}`}>{d.title}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            )}
          </div>
        </div>
        <button className="btn btn-primary shrink-0" disabled={sending} onClick={send} title="Отправить">
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
          <button type="button" className="btn btn-ghost" onClick={onClose}>Отмена</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "…" : "Создать"}</button>
        </div>
      </form>
    </Modal>
  );
}
