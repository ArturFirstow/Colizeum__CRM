"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Search, Sparkles, X, CornerDownLeft } from "lucide-react";
import { apiFetch } from "@/lib/client";

// ─────────────────────────────────────────────────────────────────────────────
// Поиск по всему сервису — Ctrl + K (на Mac ⌘ + K).
//
// ЗАЧЕМ. Путь к любой карточке был один: меню → раздел → список → поиск внутри
// раздела. Для работы, где карточку клиента открывают десятки раз в день, это
// главный тормоз. Теперь: две буквы — и ты в карточке.
//
// ЧТО ИЩЕТ: клиентов, сделки, документы, открытые задачи, заявки с сайта
// (`/api/search`, область видимости обычная) и разделы меню. Последняя строка
// всегда одна и та же — отдать вопрос ИИ-ассистенту: он знает про сервис
// больше, чем поиск по названиям, и отвечает словами.
//
// ⚠️ Окно — portal в body: иначе оно «запирается» внутри боковой панели с её
// прокруткой и фильтрами (та же причина, что у Modal).
// ─────────────────────────────────────────────────────────────────────────────

type Hit = {
  kind: "client" | "deal" | "document" | "task" | "lead";
  id: string;
  title: string;
  subtitle?: string;
  href: string;
};

type Row =
  | { type: "hit"; hit: Hit }
  | { type: "nav"; label: string; href: string }
  | { type: "ai"; query: string };

const KIND_LABEL: Record<Hit["kind"], string> = {
  client: "Клиент",
  deal: "Сделка",
  document: "Документ",
  task: "Задача",
  lead: "Заявка",
};

export function CommandPalette({ nav }: { nav: { href: string; label: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMounted(true), []);

  // Ctrl/⌘ + K открывает и закрывает; Esc закрывает.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    // Кнопка «Поиск» в меню и в мобильной шапке шлёт это же событие.
    const openEvent = () => setOpen(true);
    window.addEventListener("colizeum:open-search", openEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("colizeum:open-search", openEvent);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQ("");
      setHits([]);
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Запрос с задержкой: пока человек печатает, в базу не ходим на каждую букву.
  useEffect(() => {
    if (!open) return;
    const query = q.trim();
    if (query.length < 2) {
      setHits([]);
      return;
    }
    let alive = true;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await apiFetch<Hit[]>(`/api/search?q=${encodeURIComponent(query)}`);
        if (alive) setHits(Array.isArray(res) ? res : []);
      } catch {
        if (alive) setHits([]);
      } finally {
        if (alive) setLoading(false);
      }
    }, 180);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, open]);

  const rows: Row[] = useMemo(() => {
    const query = q.trim();
    const navHits = query
      ? nav
          .filter((n) => n.label.toLowerCase().replace(/ё/g, "е").includes(query.toLowerCase().replace(/ё/g, "е")))
          .slice(0, 4)
      : nav.slice(0, 6);
    const out: Row[] = [
      ...hits.map((h) => ({ type: "hit" as const, hit: h })),
      ...navHits.map((n) => ({ type: "nav" as const, label: n.label, href: n.href })),
    ];
    if (query.length >= 2) out.push({ type: "ai", query });
    return out;
  }, [hits, nav, q]);

  useEffect(() => {
    setCursor(0);
  }, [rows.length]);

  const go = useCallback(
    (row: Row) => {
      setOpen(false);
      if (row.type === "ai") router.push(`/assistant?q=${encodeURIComponent(row.query)}`);
      else if (row.type === "nav") router.push(row.href);
      else router.push(row.hit.href);
    },
    [router],
  );

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(rows.length - 1, c + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const row = rows[cursor];
      if (row) go(row);
    }
  }

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh]">
      <div className="absolute inset-0 bg-ink-950/75 backdrop-blur-sm animate-fade-in" onClick={() => setOpen(false)} />
      <div
        className="card relative w-full max-w-2xl overflow-hidden animate-pop"
        role="dialog"
        aria-modal="true"
        aria-label="Поиск по сервису"
      >
        <div className="flex items-center gap-3 border-b border-ink-800 px-4 py-3">
          <Search size={18} className="shrink-0 text-ink-500" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Клиент, сделка, документ, задача… или вопрос ассистенту"
            className="min-w-0 flex-1 bg-transparent text-base text-ink-50 outline-none placeholder:text-ink-500"
          />
          {loading && <span className="shrink-0 text-xs text-ink-500">ищу…</span>}
          <button
            onClick={() => setOpen(false)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-500 transition hover:bg-ink-800 hover:text-ink-200"
            aria-label="Закрыть"
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[55vh] overflow-y-auto py-1.5">
          {rows.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-ink-500">
              {q.trim().length < 2
                ? "Введите хотя бы две буквы"
                : "Ничего не нашлось — попробуйте другое слово"}
            </p>
          ) : (
            rows.map((row, i) => {
              const active = i === cursor;
              const base = `flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${
                active ? "bg-ink-800" : "hover:bg-ink-800/60"
              }`;
              if (row.type === "ai") {
                return (
                  <button key="ai" className={base} onMouseEnter={() => setCursor(i)} onClick={() => go(row)}>
                    <Sparkles size={16} className="shrink-0 text-brand" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink-100">
                        Спросить ассистента: «{row.query}»
                      </span>
                      <span className="block text-xs text-ink-500">
                        он посмотрит в карточки, базу знаний и ответит словами
                      </span>
                    </span>
                    {active && <CornerDownLeft size={14} className="shrink-0 text-ink-500" />}
                  </button>
                );
              }
              if (row.type === "nav") {
                return (
                  <button
                    key={`nav-${row.href}`}
                    className={base}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => go(row)}
                  >
                    <span className="w-16 shrink-0 text-[11px] uppercase tracking-wide text-ink-500">Раздел</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-ink-100">{row.label}</span>
                    {active && <CornerDownLeft size={14} className="shrink-0 text-ink-500" />}
                  </button>
                );
              }
              const h = row.hit;
              return (
                <button
                  key={`${h.kind}-${h.id}`}
                  className={base}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => go(row)}
                >
                  <span className="w-16 shrink-0 text-[11px] uppercase tracking-wide text-ink-500">
                    {KIND_LABEL[h.kind]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink-100">{h.title}</span>
                    {h.subtitle && <span className="block truncate text-xs text-ink-500">{h.subtitle}</span>}
                  </span>
                  {active && <CornerDownLeft size={14} className="shrink-0 text-ink-500" />}
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-ink-800 px-4 py-2 text-[11px] text-ink-500">
          <span>↑ ↓ — выбрать</span>
          <span>Enter — открыть</span>
          <span>Esc — закрыть</span>
          <span className="ml-auto">Ctrl + K</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Кнопка-строка «Поиск» для бокового меню. */
export function SearchTrigger({ className = "" }: { className?: string }) {
  return (
    <button
      onClick={() => window.dispatchEvent(new Event("colizeum:open-search"))}
      className={`flex w-full items-center gap-2.5 rounded-xl border border-ink-800 bg-ink-900/60 px-3 py-2 text-sm text-ink-400 transition hover:border-ink-700 hover:text-ink-200 ${className}`}
    >
      <Search size={15} className="shrink-0" />
      <span className="min-w-0 flex-1 truncate text-left">Поиск и ассистент</span>
      <kbd className="shrink-0 rounded border border-ink-700 px-1.5 py-0.5 text-[10px] text-ink-500">⌘K</kbd>
    </button>
  );
}
