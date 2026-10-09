"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client";

// ─────────────────────────────────────────────────────────────────────────────
// Привязка Telegram сотрудникам (просьба коллег И-11).
//
// Чтобы уведомления дошли, нужны два действия: сотрудник пишет боту (Telegram
// не разрешает боту писать первым — защита от спама) и кто-то связывает его
// чат с учётной записью. Вторая половина делалась командой на сервере, то есть
// упиралась в одного человека с доступом по SSH. Поэтому уведомления так и
// работали только у админа.
//
// Здесь это одно нажатие: слева — кто написал боту, справа — кому привязать.
// ─────────────────────────────────────────────────────────────────────────────

type Chat = { chatId: string; name: string; username: string | null };
type Member = { id: string; name: string; email: string; telegramChatId: string | null };

export function TelegramBinding({ members }: { members: Member[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await apiFetch<{
        configured: boolean;
        chats: Chat[];
        error?: string;
        hint?: string;
      }>("/api/telegram/chats");
      setConfigured(r.configured);
      setChats(r.chats);
      setError(r.error ?? null);
      setHint(r.hint ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  async function bind(userId: string, chatId: string | null) {
    setBusy(userId);
    try {
      await apiFetch("/api/telegram/chats", {
        method: "POST",
        body: JSON.stringify({ userId, chatId }),
      });
      router.refresh();
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setBusy(null);
    }
  }

  const connected = members.filter((m) => m.telegramChatId).length;
  const usedChats = new Set(members.map((m) => m.telegramChatId).filter(Boolean) as string[]);

  return (
    <section className="card mt-6 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="font-semibold text-ink-50">Уведомления в Telegram</h2>
          <p className="mt-1 text-sm text-ink-400">
            Подключено у {connected} из {members.length}. Чтобы подключить сотрудника, он должен
            сначала написать боту — Telegram не разрешает боту писать первым.
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen((v) => !v)}>
          {open ? "Свернуть" : "Настроить"}
        </button>
      </div>

      {open && (
        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-ink-800 bg-ink-900/50 px-4 py-3 text-sm text-ink-300">
            <b className="text-ink-100">Что сказать коллеге:</b> «Найди в Telegram нашего бота и
            отправь ему <code className="text-brand">/start</code>». Больше от него ничего не нужно —
            остальное вы сделаете здесь.
          </div>

          {loading && <p className="text-sm text-ink-400">Спрашиваем у Telegram…</p>}

          {configured === false && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              Бот ещё не настроен. {hint}
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          {!loading && configured && chats.length === 0 && !error && (
            <p className="text-sm text-ink-400">
              Боту пока никто не писал. Попросите коллег отправить ему <code>/start</code> и нажмите
              «Настроить» ещё раз.
              <br />
              <span className="text-xs text-ink-500">
                Telegram помнит последние сообщения ограниченное время — если кто-то писал давно,
                пусть напишет снова.
              </span>
            </p>
          )}

          {chats.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wide text-ink-500">Кому подключить</div>
              {members.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-ink-800 bg-ink-900/50 px-4 py-2.5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink-100">{m.name}</span>
                    <span className="block truncate text-xs text-ink-500">{m.email}</span>
                  </span>

                  {m.telegramChatId ? (
                    <>
                      <span className="text-xs text-emerald-300">подключено</span>
                      <button
                        className="text-xs text-ink-500 underline underline-offset-2 hover:text-red-300"
                        disabled={busy === m.id}
                        onClick={() => bind(m.id, null)}
                      >
                        отключить
                      </button>
                    </>
                  ) : (
                    <select
                      className="input h-8 w-auto py-0 text-xs"
                      defaultValue=""
                      disabled={busy === m.id}
                      onChange={(e) => e.target.value && bind(m.id, e.target.value)}
                    >
                      <option value="">— выбрать, кто это в Telegram —</option>
                      {chats.map((c) => (
                        <option key={c.chatId} value={c.chatId} disabled={usedChats.has(c.chatId)}>
                          {c.name}
                          {c.username ? ` (@${c.username})` : ""}
                          {usedChats.has(c.chatId) ? " — уже занят" : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
