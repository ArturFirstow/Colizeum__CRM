"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HelpCircle, CheckCircle2, Target, Ban, X } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Всплывающие уведомления в правом нижнем углу.
//
// Раз в 30 секунд спрашиваем сервер «что нового с прошлой проверки». Момент
// последней проверки храним в браузере, поэтому при возврате на вкладку человек
// увидит то, что пришло, пока его не было, а не пустоту.
// ─────────────────────────────────────────────────────────────────────────────

type Item = {
  id: string;
  kind: "decision" | "answer" | "task" | "blocker";
  title: string;
  body: string;
  href: string;
  at: string;
};

const POLL_MS = 30_000;
const STORAGE_KEY = "colizeum_notifications_since";

const ICON = {
  decision: HelpCircle,
  answer: CheckCircle2,
  task: Target,
  blocker: Ban,
} as const;

const TONE: Record<Item["kind"], string> = {
  decision: "!border-brand/50",
  answer: "!border-emerald-500/40",
  task: "!border-brand/40",
  blocker: "!border-red-500/40",
};

const ICON_TONE: Record<Item["kind"], string> = {
  decision: "bg-brand/15 text-brand",
  answer: "bg-emerald-500/15 text-emerald-300",
  task: "bg-brand/15 text-brand",
  blocker: "bg-red-500/15 text-red-300",
};

export function Notifications() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  // Уже показанные не показываем повторно: поллинг может вернуть их снова.
  const seen = useRef<Set<string>>(new Set());

  const poll = useCallback(async () => {
    // Вкладка в фоне — не дёргаем сервер зря.
    if (typeof document !== "undefined" && document.hidden) return;
    try {
      const since = localStorage.getItem(STORAGE_KEY) ?? "";
      const res = await fetch(`/api/notifications${since ? `?since=${encodeURIComponent(since)}` : ""}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { data?: { items: Item[]; now: string } };
      const payload = data.data;
      if (!payload) return;

      localStorage.setItem(STORAGE_KEY, payload.now);
      const fresh = payload.items.filter((i) => !seen.current.has(i.id));
      if (fresh.length === 0) return;
      for (const i of fresh) seen.current.add(i.id);
      setItems((prev) => [...fresh, ...prev].slice(0, 4));
      // Данные на открытой странице могли устареть — подтягиваем.
      router.refresh();
    } catch {
      // Сеть моргнула — молча ждём следующей попытки.
    }
  }, [router]);

  useEffect(() => {
    poll();
    const timer = setInterval(poll, POLL_MS);
    // Вернулись на вкладку — проверяем сразу, не дожидаясь таймера.
    const onVisible = () => {
      if (!document.hidden) poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [poll]);

  function dismiss(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  if (items.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
      {items.map((n) => {
        const Icon = ICON[n.kind];
        return (
          <div
            key={n.id}
            className={`card pointer-events-auto flex items-start gap-3 p-3.5 shadow-xl ${TONE[n.kind]}`}
            role="status"
          >
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${ICON_TONE[n.kind]}`}>
              <Icon size={16} />
            </span>
            <Link href={n.href} onClick={() => dismiss(n.id)} className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-ink-50">{n.title}</div>
              <div className="mt-0.5 line-clamp-2 text-xs text-ink-400">{n.body}</div>
            </Link>
            <button
              onClick={() => dismiss(n.id)}
              className="shrink-0 rounded-lg p-1 text-ink-500 transition hover:bg-ink-800 hover:text-ink-200"
              title="Скрыть"
              aria-label="Скрыть уведомление"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
