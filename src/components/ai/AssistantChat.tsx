"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles, Send, Paperclip, X, Inbox, Search, AlertTriangle } from "lucide-react";
import { apiFetch } from "@/lib/client";

type Msg = { role: "user" | "assistant"; content: string; html?: string; steps?: string[] };

const SUGGESTIONS = [
  "Разложи приложенный файл по разделам",
  "Что сегодня в приоритете?",
  "Саммари по моим клиентам за неделю",
  "По каким сделкам есть блокеры?",
];

type InboxFile = { id: string; title: string; fileName: string; sizeBytes: number };

export function AssistantChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inbox, setInbox] = useState<InboxFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // «Входящие» напарника: файлы, которые сотрудник закинул, но ещё не разложил.
  const loadInbox = useCallback(async () => {
    try {
      const list = await apiFetch<InboxFile[]>("/api/ai/inbox");
      setInbox(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error("inbox", e);
    }
  }, []);

  useEffect(() => {
    loadInbox();
  }, [loadInbox]);

  async function uploadFiles(list: FileList | File[] | null) {
    const arr = list ? Array.from(list) : [];
    if (arr.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const f of arr) {
        const fd = new FormData();
        fd.append("file", f);
        fd.append("ownerType", "inbox");
        fd.append("ownerId", "me");
        fd.append("kind", "Входящее");
        fd.append("title", f.name.replace(/\.[^.]+$/, ""));
        await apiFetch("/api/files", { method: "POST", body: fd });
      }
      if (fileRef.current) fileRef.current.value = "";
      await loadInbox();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить файл");
    } finally {
      setUploading(false);
    }
  }

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || loading) return;
    setError(null);
    const history = [...messages, { role: "user" as const, content: q }];
    setMessages(history);
    setInput("");
    setLoading(true);
    try {
      const r = await apiFetch<{ reply: string; html: string; steps?: string[] }>("/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({ messages: history.map((m) => ({ role: m.role, content: m.content })) }),
      });
      setMessages((m) => [...m, { role: "assistant", content: r.reply, html: r.html, steps: r.steps ?? [] }]);
      loadInbox();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка ИИ");
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-9rem)] max-w-3xl flex-col">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-brand/30 bg-brand/10 text-xl">
          <Sparkles size={20} className="text-brand" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold uppercase tracking-wide text-ink-50">ИИ-ассистент</h1>
          <p className="mt-0.5 text-sm text-ink-300">Видит ваш кабинет — клиентов, сделки, базу знаний</p>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto rounded-2xl border border-ink-800 bg-ink-900/40 p-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <Sparkles size={32} className="text-brand/70" />
            <p className="max-w-md text-sm text-ink-400">
              Закиньте счёт, макет или расшифровку встречи — напарник поймёт, что это, и разложит по нужным разделам.
              Или просто спросите про клиентов, сроки и приоритеты.
            </p>
            <div className="flex max-w-lg flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="pill bg-ink-800/60 text-ink-200 ring-1 ring-inset ring-ink-700 transition hover:bg-ink-800"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-brand/15 px-4 py-2 text-sm text-ink-50 ring-1 ring-inset ring-brand/25">
                {m.content}
              </div>
            </div>
          ) : (
            <div key={i} className="flex flex-col items-start gap-1">
              <div
                className="prose-kb max-w-[85%] rounded-2xl rounded-bl-sm border border-ink-800 bg-ink-900/70 px-4 py-2 text-sm"
                dangerouslySetInnerHTML={{ __html: m.html ?? m.content }}
              />
              {/* Куда напарник заглянул. Пустой список — тревожный знак:
                  значит, ответ придуман, а не взят из данных сервиса. */}
              {m.steps &&
                (m.steps.length > 0 ? (
                  <p className="max-w-[85%] pl-1 text-xs text-ink-500">
                    <Search size={11} className="mr-1 inline align-[-1px]" />
                    Смотрел: {m.steps.join(" → ")}
                  </p>
                ) : (
                  <p className="max-w-[85%] pl-1 text-xs text-amber-500/80">
                    <AlertTriangle size={11} className="mr-1 inline align-[-1px]" />
                    Ответил без обращения к данным сервиса — проверьте факты
                  </p>
                ))}
            </div>
          ),
        )}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-ink-400">
            <Sparkles size={15} className="animate-pulse text-brand" /> ИИ смотрит ваш кабинет…
          </div>
        )}
        {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>}
        <div ref={endRef} />
      </div>

      {inbox.length > 0 && (
        <div className="mt-3 rounded-xl border border-brand/25 bg-brand/[0.05] px-3 py-2">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand-200">
            <Inbox size={13} /> На разбор ({inbox.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {inbox.map((f) => (
              <span
                key={f.id}
                className="inline-flex items-center gap-1.5 rounded-lg bg-ink-900/70 px-2 py-1 text-xs text-ink-200 ring-1 ring-inset ring-ink-700"
              >
                <Paperclip size={11} className="text-brand/70" />
                <span className="max-w-[200px] truncate">{f.fileName}</span>
                <button
                  onClick={async () => {
                    await apiFetch(`/api/files/${f.id}`, { method: "DELETE" });
                    loadInbox();
                  }}
                  className="text-ink-500 hover:text-red-400"
                  title="Убрать"
                >
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-ink-500">
            Напишите, к какому клиенту это относится — напарник разложит файл по разделам.
          </p>
        </div>
      )}

      <div className="mt-3 flex items-end gap-2">
        <button
          className="btn btn-ghost shrink-0"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          title="Прикрепить счёт, макет, медиаплан или документ"
        >
          <Paperclip size={16} />
        </button>
        <input ref={fileRef} type="file" multiple hidden onChange={(e) => uploadFiles(e.target.files)} />
        <textarea
          className="input min-h-[48px] flex-1 resize-none"
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Спросите про клиента, сделку, приоритеты… (Enter — отправить)"
          disabled={loading}
        />
        <button className="btn btn-primary shrink-0" disabled={loading || !input.trim()} onClick={() => send(input)} title="Отправить">
          <Send size={16} />
        </button>
      </div>
      <p className="mt-1.5 text-center text-[11px] text-ink-600">
        Напарник видит только ваш кабинет и раскладывает файлы по разделам. Проверяйте важное — ИИ может ошибаться.
      </p>
    </div>
  );
}
