"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { TIMELINE_KINDS, type TimelineEvent, type TimelineKind } from "@/lib/timeline";
import { AiTimelineSummaryButton } from "@/components/ai/AiButtons";

// ─────────────────────────────────────────────────────────────────────────────
// Хронология по клиенту: одна лента вместо обхода пяти разделов.
//
// Свежее сверху. События сгруппированы по дням, будущее (плановая оплата,
// срок задачи, запуск) отделено от факта — иначе план читается как сделанное.
// ─────────────────────────────────────────────────────────────────────────────

const PAGE = 15;

// Цвет полоски слева — чтобы тип события считывался, не читая текст.
const ACCENT: Record<TimelineKind, string> = {
  Сделка: "border-brand/60",
  Встреча: "border-sky-400/50",
  Статус: "border-ink-600",
  Задача: "border-violet-400/50",
  Документ: "border-emerald-400/50",
  Деньги: "border-amber-400/60",
  Размещение: "border-cyan-400/50",
  ОРД: "border-fuchsia-400/50",
};

export function ClientTimeline({
  advertiserId,
  events,
}: {
  advertiserId: string;
  events: TimelineEvent[];
}) {
  const [active, setActive] = useState<TimelineKind | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const [aheadOpen, setAheadOpen] = useState(false);

  // Сколько событий каждого типа — показываем прямо на кнопке фильтра,
  // чтобы не тыкать в пустые.
  const counts = useMemo(() => {
    const map = new Map<TimelineKind, number>();
    for (const e of events) map.set(e.kind, (map.get(e.kind) ?? 0) + 1);
    return map;
  }, [events]);

  const filtered = useMemo(
    () => (active ? events.filter((e) => e.kind === active) : events),
    [events, active],
  );

  // Будущее отделено от прошлого. Иначе открытая карточка встречает стеной
  // плановых платежей на год вперёд, а история — где-то под ними.
  const ahead = useMemo(() => filtered.filter((e) => e.planned).reverse(), [filtered]);
  const history = useMemo(() => filtered.filter((e) => !e.planned), [filtered]);

  const shown = history.slice(0, limit);
  const groups = useMemo(() => groupByDay(shown), [shown]);

  const firstDate = events.length ? new Date(events[events.length - 1].date) : null;

  return (
    <section className="card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink-50">Хронология</h2>
          <p className="mt-0.5 text-sm text-ink-400">
            {events.length === 0
              ? "Пока пусто — события появятся сами, как только что-то произойдёт по клиенту."
              : `${events.length} ${plural(events.length, "событие", "события", "событий")}${
                  firstDate ? ` · с ${firstDate.toLocaleDateString("ru-RU")}` : ""
                }`}
          </p>
        </div>
        {events.length > 0 && <AiTimelineSummaryButton advertiserId={advertiserId} />}
      </div>

      {events.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          <FilterChip label="Всё" count={events.length} on={active === null} onClick={() => setActive(null)} />
          {TIMELINE_KINDS.filter((k) => counts.has(k)).map((k) => (
            <FilterChip
              key={k}
              label={k}
              count={counts.get(k) ?? 0}
              on={active === k}
              onClick={() => {
                setActive(active === k ? null : k);
                setLimit(PAGE);
              }}
            />
          ))}
        </div>
      )}

      {events.length === 0 ? (
        <p className="text-sm text-ink-500">
          Сюда сами собираются: сделки, встречи из дневника, статусы дня, задачи, документы и файлы, оплаты,
          размещения и маркировка ОРД.
        </p>
      ) : (
        <div className="space-y-5">
          {/* Что впереди: планы и сроки, ближайшее — сверху. Свёрнуто, потому
              что открывают карточку обычно ради того, что уже было. */}
          {ahead.length > 0 && (
            <div className="rounded-xl border border-ink-800 bg-ink-900/40 p-3">
              <button
                className="flex w-full items-center justify-between text-left"
                onClick={() => setAheadOpen((v) => !v)}
              >
                <span className="text-sm font-semibold text-ink-200">
                  Впереди: {ahead.length} {plural(ahead.length, "событие", "события", "событий")}
                </span>
                <span className="text-xs text-ink-500">{aheadOpen ? "свернуть ▲" : "показать ▼"}</span>
              </button>
              {!aheadOpen && ahead[0] && (
                <div className="mt-1.5 truncate text-xs text-ink-400">
                  ближайшее — {new Date(ahead[0].date).toLocaleDateString("ru-RU")}: {ahead[0].title}
                </div>
              )}
              {aheadOpen && (
                <div className="mt-3 space-y-2">
                  {ahead.map((e) => (
                    <EventRow key={e.id} event={e} />
                  ))}
                </div>
              )}
            </div>
          )}

          {history.length === 0 && (
            <p className="text-sm text-ink-500">
              По этому фильтру ещё ничего не произошло — всё, что есть, ещё впереди.
            </p>
          )}

          {groups.map((g) => (
            <div key={g.key}>
              <div className="mb-2 flex items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">{g.label}</span>
                <span className="h-px flex-1 bg-ink-800" />
              </div>
              <div className="space-y-2">
                {g.items.map((e) => (
                  <EventRow key={e.id} event={e} />
                ))}
              </div>
            </div>
          ))}

          {history.length > shown.length && (
            <button className="btn btn-ghost btn-sm" onClick={() => setLimit((l) => l + PAGE * 2)}>
              Показать ещё ({history.length - shown.length})
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function FilterChip({
  label,
  count,
  on,
  onClick,
}: {
  label: string;
  count: number;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs transition ${
        on
          ? "border-brand bg-brand/15 text-brand"
          : "border-ink-800 text-ink-400 hover:border-ink-600 hover:text-ink-200"
      }`}
    >
      {label} <span className="opacity-60">{count}</span>
    </button>
  );
}

function EventRow({ event }: { event: TimelineEvent }) {
  const time = new Date(event.date).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  const body = (
    <div
      className={`rounded-xl border-l-2 ${ACCENT[event.kind]} border-y border-r border-y-ink-800 border-r-ink-800 bg-ink-900/50 px-4 py-3 ${
        event.href ? "transition hover:border-y-ink-600 hover:border-r-ink-600 hover:bg-ink-800" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 text-ink-400">{event.icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-ink-100">{event.title}</span>
            {event.planned && <span className="badge badge-muted">план</span>}
          </div>
          {event.detail && <div className="mt-1 text-xs leading-relaxed text-ink-400">{event.detail}</div>}
          <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-ink-500">
            <span>{event.kind}</span>
            {event.dealTitle && <span>по сделке «{event.dealTitle}»</span>}
            {time !== "00:00" && <span>{time}</span>}
          </div>
        </div>
      </div>
    </div>
  );

  return event.href ? (
    <Link href={event.href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

// Группировка по дню + человеческие подписи «Сегодня»/«Вчера».
function groupByDay(events: TimelineEvent[]) {
  const today = dayKey(new Date());
  const yesterday = dayKey(new Date(Date.now() - 86400000));

  const out: { key: string; label: string; items: TimelineEvent[] }[] = [];
  for (const e of events) {
    const d = new Date(e.date);
    const key = dayKey(d);
    let group = out[out.length - 1];
    if (!group || group.key !== key) {
      group = {
        key,
        label:
          key === today
            ? "Сегодня"
            : key === yesterday
              ? "Вчера"
              : d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }),
        items: [],
      };
      out.push(group);
    }
    group.items.push(e);
  }
  return out;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
