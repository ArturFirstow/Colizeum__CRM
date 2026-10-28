"use client";

import { useMemo, useState } from "react";
import { Sparkles, CheckCircle2, AlertTriangle, Copy, Send, Search, Mic, NotebookPen } from "lucide-react";
import { apiFetch } from "@/lib/client";
import { Modal, FormError } from "@/components/ui/Modal";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { FileCell } from "@/components/ui/FileCell";
import { JournalNew } from "@/components/journal/JournalNew";
import { formatDateTime } from "@/lib/format";

// Недельное ИИ-саммари: собирает прогресс по каждому партнёру за 7 дней.
function WeeklyAiSummary() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setOpen(true);
    setLoading(true);
    setError(null);
    setHtml(null);
    try {
      const data = (await apiFetch("/api/reports/weekly-ai", { method: "POST" })) as { html: string };
      setHtml(data.html);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button className="btn btn-ghost" onClick={generate}>
        <Sparkles size={15} /> Недельное саммари
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Недельное саммари" subtitle="ИИ собрал прогресс по партнёрам за 7 дней" size="lg">
        {loading && (
          <div className="space-y-3">
            <div className="skeleton h-5 w-2/5" />
            <div className="skeleton h-3.5 w-full" />
            <div className="skeleton h-3.5 w-4/5" />
            <div className="skeleton h-5 w-1/3" />
            <div className="skeleton h-3.5 w-full" />
            <div className="skeleton h-3.5 w-3/5" />
            <p className="pt-1 text-xs text-ink-500">Собираю статусы, журнал и сделки, пишу саммари…</p>
          </div>
        )}
        {error && <FormError message={error} />}
        {html && <div className="prose-kb" dangerouslySetInnerHTML={{ __html: html }} />}
      </Modal>
    </>
  );
}

type Entry = {
  id: string;
  date: string | Date;
  source: string;
  rawText: string;
  parsedSummary: string | null;
  routedTo: string | null;
  meetingWith?: string | null;
  advertiserId?: string | null;
  meetingDate?: string | Date | null;
  startTime?: string | null;
  endTime?: string | null;
  durationHours?: number | null;
  participants?: string | null;
  protocolUrl?: string | null;
  meetingUrl?: string | null;
  exportedAt?: string | Date | null;
  exportError?: string | null;
};

type AdvOpt = { id: string; nameRu: string };

/** Заголовок дня в ленте: «Сегодня», «Вчера», «7 октября». */
function dayLabel(d: Date): string {
  const today = new Date();
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (same(d, today)) return "Сегодня";
  if (same(d, yesterday)) return "Вчера";
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    ...(d.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}),
  });
}

type Filter = "Все" | "Встречи" | "Итоги дня";
const FILTERS: Filter[] = ["Все", "Встречи", "Итоги дня"];

// ─────────────────────────────────────────────────────────────────────────────
// Дневник: сначала читаем, потом пишем.
//
// Раньше страница была пополам: слева всегда открытая анкета на девять полей,
// справа — узкая лента. Человек заходит сюда в основном ПОЧИТАТЬ («что мы
// решили на встрече во вторник»), а экран был занят формой.
//
// Теперь лента во всю ширину и сгруппирована по дням, сверху — поиск и три
// фильтра, а запись заводится кнопкой «+ Новая запись» в окне (JournalNew).
// ─────────────────────────────────────────────────────────────────────────────
export function JournalView({
  entries,
  advertisers = [],
  sheetConfigured = false,
}: {
  entries: Entry[];
  advertisers?: AdvOpt[];
  sheetConfigured?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("Все");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (filter === "Встречи" && e.source !== "Транскрипт") return false;
      if (filter === "Итоги дня" && e.source === "Транскрипт") return false;
      if (!q) return true;
      return [e.rawText, e.parsedSummary, e.meetingWith, e.participants]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [entries, filter, query]);

  // Группировка по дням: без неё лента читается как сплошной поток карточек.
  const days = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const e of visible) {
      const d = new Date(e.date);
      const key = d.toDateString();
      const list = map.get(key);
      if (list) list.push(e);
      else map.set(key, [e]);
    }
    return [...map.entries()].map(([key, items]) => ({ key, date: new Date(key), items }));
  }, [visible]);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-ink-700 bg-ink-800/60 text-xl">
            ✎
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold uppercase tracking-wide text-ink-50">
              Дневник
            </h1>
            {/* Подзаголовок говорит, ЧТО ЗДЕСЬ ДЕЛАЮТ, а не чем раздел является. */}
            <p className="mt-0.5 text-sm text-ink-300">
              Вставьте расшифровку встречи — ИИ разложит её по полям, а строка уйдёт в таблицу
              отчётности.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <WeeklyAiSummary />
          <JournalNew advertisers={advertisers} sheetConfigured={sheetConfigured} />
        </div>
      </div>

      {entries.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3.5 py-1.5 text-sm transition ${
                filter === f
                  ? "bg-brand text-ink-950 font-semibold"
                  : "border border-ink-700 text-ink-300 hover:border-ink-600 hover:text-ink-100"
              }`}
            >
              {f}
            </button>
          ))}
          <div className="relative ml-auto">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
            <input
              className="input h-10 w-64 pl-9"
              placeholder="Поиск по записям…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      )}

      {entries.length === 0 ? (
        // Пустое состояние объясняет смысл раздела — это первое, что видит
        // человек, открывший «Дневник» впервые.
        <div className="card p-10 text-center">
          <div className="text-3xl">🎙</div>
          <h2 className="mt-3 text-lg font-semibold text-ink-50">Записей пока нет</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-400">
            Сюда складывают расшифровки встреч и короткие итоги дня. Из них собирается недельный
            отчёт, а встречи попадают в историю клиента и в таблицу учёта.
          </p>
          <div className="mt-5 flex justify-center">
            <JournalNew advertisers={advertisers} sheetConfigured={sheetConfigured} />
          </div>
        </div>
      ) : visible.length === 0 ? (
        <div className="card p-8 text-center text-sm text-ink-400">
          Ничего не нашлось. Измените запрос или фильтр.
        </div>
      ) : (
        <div className="space-y-6">
          {days.map((day) => (
            <section key={day.key}>
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-500">
                {dayLabel(day.date)}
              </div>
              <div className="space-y-3">
                {day.items.map((e) => (
                  <article key={e.id} className="card p-4">
                    <div className="mb-2 flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        {/* Заголовок карточки — человеческий: с кем встречались
                            или «Итог дня», а не технический тип записи. */}
                        <div className="flex items-center gap-2">
                          <span className="text-ink-400">
                            {e.source === "Транскрипт" ? <Mic size={15} /> : <NotebookPen size={15} />}
                          </span>
                          <h3 className="truncate text-base font-semibold text-ink-50">
                            {e.source === "Транскрипт"
                              ? e.meetingWith
                                ? `Встреча с ${e.meetingWith}`
                                : "Встреча"
                              : "Итог дня"}
                          </h3>
                        </div>
                      </div>
                      <span className="shrink-0 text-xs text-ink-500">{formatDateTime(e.date)}</span>
                      <DeleteButton endpoint={`/api/journal/${e.id}`} what="запись журнала" />
                    </div>

                    {e.meetingDate && <MeetingRow entry={e} />}
                    {e.parsedSummary && (
                      <p className="mb-2 rounded-lg bg-ink-900/60 px-3 py-2 text-sm text-brand-100">
                        {e.parsedSummary}
                      </p>
                    )}
                    <RawText text={e.rawText} />
                    <div className="mt-3">
                      <FileCell
                        ownerType="journal"
                        ownerId={e.id}
                        kind="Запись встречи"
                        advertiserId={e.advertiserId ?? undefined}
                        label="Прикрепить запись или расшифровку"
                        compact
                      />
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

// Показатели встречи в ленте + состояние выгрузки в таблицу отчётности.
function MeetingRow({ entry }: { entry: Entry }) {
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<{ ok: boolean; text: string } | null>(
    entry.exportedAt
      ? { ok: true, text: "строка в таблице" }
      : entry.exportError
        ? { ok: false, text: entry.exportError }
        : null,
  );
  const [copied, setCopied] = useState(false);

  const date = entry.meetingDate ? new Date(entry.meetingDate) : null;
  const dateText = date
    ? `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}`
    : "";
  const hours = entry.durationHours ?? null;

  async function send() {
    setBusy(true);
    setCopied(false);
    try {
      const r = (await apiFetch(`/api/journal/${entry.id}/export`, { method: "POST" })) as {
        ok: boolean;
        configured: boolean;
        error?: string;
        tsv?: string;
      };
      if (r.ok) {
        setState({ ok: true, text: "строка в таблице" });
      } else if (!r.configured) {
        if (r.tsv) await navigator.clipboard.writeText(r.tsv);
        setCopied(true);
        setState({ ok: false, text: "выгрузка не настроена — строка скопирована в буфер" });
      } else {
        setState({ ok: false, text: r.error ?? "не удалось отправить" });
      }
    } catch (err) {
      setState({ ok: false, text: err instanceof Error ? err.message : "ошибка" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-2 rounded-lg border border-ink-800 bg-ink-900/40 px-3 py-2 text-xs text-ink-300">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium text-ink-100">{dateText}</span>
        {entry.startTime && (
          <span>
            {entry.startTime}
            {entry.endTime ? `–${entry.endTime}` : ""}
          </span>
        )}
        {hours != null && <span className="badge badge-muted">{hours.toFixed(1).replace(".", ",")} ч</span>}
        {entry.participants && <span className="text-ink-400">{entry.participants}</span>}
        {entry.protocolUrl && (
          <a href={entry.protocolUrl} target="_blank" rel="noreferrer" className="text-brand hover:underline">
            протокол ↗
          </a>
        )}
        {entry.meetingUrl && (
          <a href={entry.meetingUrl} target="_blank" rel="noreferrer" className="text-brand hover:underline">
            встреча ↗
          </a>
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        {state?.ok ? (
          <span className="flex items-center gap-1 text-emerald-300">
            <CheckCircle2 size={12} /> {state.text}
          </span>
        ) : state ? (
          <span className="flex items-center gap-1 text-amber-300">
            {copied ? <Copy size={12} /> : <AlertTriangle size={12} />} {state.text}
          </span>
        ) : (
          <span className="text-ink-500">в таблицу не отправлялась</span>
        )}
        <button className="btn btn-ghost btn-sm" onClick={send} disabled={busy}>
          <Send size={12} /> {busy ? "…" : state?.ok ? "Отправить ещё раз" : "Отправить в таблицу"}
        </button>
      </div>
    </div>
  );
}


// Текст записи: свёрнут до трёх строк, разворачивается по клику.
function RawText({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 220;

  if (!long) return <p className="whitespace-pre-wrap text-sm text-ink-300">{text}</p>;

  return (
    <div>
      <p className={`whitespace-pre-wrap text-sm text-ink-300 ${open ? "" : "line-clamp-3"}`}>{text}</p>
      <button
        type="button"
        className="mt-1 text-xs text-brand hover:underline"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "свернуть" : "показать полностью"}
      </button>
    </div>
  );
}
