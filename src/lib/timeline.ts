// Типы и словари хронологии клиента.
//
// Отдельный файл от сервиса (`services/client-timeline.ts`) намеренно: сервис
// помечен "server-only" и ходит в базу, а эти типы нужны ещё и компоненту в
// браузере. Импортировать серверный модуль в клиентский нельзя.

/** Группы событий — по ним же работают фильтры в интерфейсе. */
export const TIMELINE_KINDS = [
  "Сделка",
  "Встреча",
  "Статус",
  "Задача",
  "Документ",
  "Деньги",
  "Размещение",
  "ОРД",
] as const;

export type TimelineKind = (typeof TIMELINE_KINDS)[number];

export type TimelineEvent = {
  id: string;
  /** ISO-строка: сервер отдаёт клиентскому компоненту простые типы. */
  date: string;
  kind: TimelineKind;
  icon: string;
  title: string;
  detail?: string | null;
  /** К какой сделке относится событие (подпись «по сделке …»). */
  dealTitle?: string | null;
  /** Куда ведёт клик, если есть куда. */
  href?: string | null;
  /** Событие в будущем — это план, а не факт (запуск, плановая оплата). */
  planned?: boolean;
};

export const TIMELINE_ICONS: Record<TimelineKind, string> = {
  Сделка: "⑂",
  Встреча: "🗣",
  Статус: "◆",
  Задача: "✓",
  Документ: "❐",
  Деньги: "₽",
  Размещение: "▦",
  ОРД: "❖",
};
