"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Send } from "lucide-react";
import { apiFetch } from "@/lib/client";

type Msg = { role: "user" | "assistant"; content: string; html?: string };

const SUGGESTIONS = [
  "Саммари по моим клиентам за неделю",
  "Что сегодня в приоритете?",
  "Проверь клиента Алабуга и подскажи, как ускорить оплату",
  "По каким сделкам есть блокеры?",
];

export function AssistantChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

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
      const r = await apiFetch<{ reply: string; html: string }>("/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({ messages: history.map((m) => ({ role: m.role, content: m.content })) }),
      });
      setMessages((m) => [...m, { role: "assistant", content: r.reply, html: r.html }]);
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
              Спросите что угодно про ваших клиентов и сделки. ИИ сам посмотрит нужные карточки и базу знаний.
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
            <div key={i} className="flex justify-start">
              <div
                className="prose-kb max-w-[85%] rounded-2xl rounded-bl-sm border border-ink-800 bg-ink-900/70 px-4 py-2 text-sm"
                dangerouslySetInnerHTML={{ __html: m.html ?? m.content }}
              />
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

      <div className="mt-3 flex items-end gap-2">
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
      <p className="mt-1.5 text-center text-[11px] text-ink-600">ИИ может ошибаться — проверяйте важное. Ответы строятся по данным вашего кабинета.</p>
    </div>
  );
}
