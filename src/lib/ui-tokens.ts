// Цветовые токены для стадий, статусов, типов — единый визуальный язык.
// Возвращаем классы Tailwind (важно: перечислены явно, чтобы не вырезал purge).

import type { DealStage } from "./enums";

// Пять шагов — пять цветов, от нейтрального к зелёному: по цвету видно, далеко
// ли сделка продвинулась, даже не читая подпись.
export const STAGE_STYLES: Record<string, string> = {
  Лид: "bg-ink-600/50 text-ink-100 ring-ink-500/50",
  Договор: "bg-indigo-500/15 text-indigo-300 ring-indigo-500/30",
  Оплата: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  Размещение: "bg-brand/15 text-brand-200 ring-brand/30",
  Закрытие: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
};

export function stageStyle(stage: string): string {
  return STAGE_STYLES[stage] ?? "bg-ink-600/50 text-ink-100 ring-ink-500/50";
}

export const TASK_STATUS_STYLES: Record<string, string> = {
  Открыта: "bg-ink-600/50 text-ink-100 ring-ink-500/50",
  "В работе": "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  Ждёт: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  Готова: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
};

export function taskStatusStyle(status: string): string {
  return TASK_STATUS_STYLES[status] ?? "bg-ink-600/50 text-ink-100 ring-ink-500/50";
}

export const URGENCY_STYLES: Record<string, string> = {
  Максимальная: "bg-red-500/15 text-red-300 ring-red-500/30",
  Высокая: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  Средняя: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  Низкая: "bg-ink-600/50 text-ink-200 ring-ink-500/50",
  "По запросу": "bg-violet-500/15 text-violet-300 ring-violet-500/30",
  Разово: "bg-teal-500/15 text-teal-300 ring-teal-500/30",
};

// ─────────────────────────────────────────────────────────────────────────────
// Семантические цвета, которые раньше писались прямо в компонентах.
// ⚠️ Правило: цвет со СМЫСЛОМ живёт здесь, а не в классе на месте. Иначе при
// смене палитры «у клиента» в задачах и «у клиента» на «Сегодня» разъедутся.
// ─────────────────────────────────────────────────────────────────────────────

/** Сторона, на которой сейчас мяч: у нас или у клиента. */
export const SIDE_STYLES = {
  Клиент: {
    column: "border-sky-500/25 bg-sky-500/[0.04]",
    badge: "bg-sky-500/15 text-sky-300 ring-1 ring-inset ring-sky-500/30",
  },
  Мы: {
    column: "border-ink-700 bg-ink-900/40",
    badge: "bg-ink-700/60 text-ink-200 ring-1 ring-inset ring-ink-600/50",
  },
} as const;

export function sideStyle(side: string | null | undefined, part: "column" | "badge") {
  return (side === "Клиент" ? SIDE_STYLES["Клиент"] : SIDE_STYLES["Мы"])[part];
}

/** Повторяющаяся пометка «акты закрываются ежемесячно» (ОРД). */
export const RECURRING_NOTE = "text-teal-300";

/** Статусы креатива — те же цвета, что у остальных состояний сервиса. */
export const CREATIVE_STATUS_STYLES: Record<string, string> = {
  "В работе": "border-sky-500/30 bg-sky-500/10 text-sky-200",
  "На согласовании": "border-amber-500/30 bg-amber-500/10 text-amber-200",
  Согласован: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  Отклонён: "border-red-500/30 bg-red-500/10 text-red-200",
};

/** Полоса срочности слева на карточке сделки — цвет без текста. */
export const URGENCY_BAR: Record<string, string> = {
  Максимальная: "bg-red-500",
  Высокая: "bg-amber-400",
  Средняя: "bg-sky-500/60",
  Низкая: "bg-ink-600",
  "По запросу": "bg-violet-500/60",
  Разово: "bg-teal-500/60",
};

export function urgencyStyle(u?: string | null): string {
  return (u && URGENCY_STYLES[u]) || "bg-ink-600/50 text-ink-200 ring-ink-500/50";
}

export const ADVERTISER_TYPE_STYLES: Record<string, string> = {
  Рекламодатель: "bg-brand/15 text-brand-200 ring-brand/30",
  Агентство: "bg-violet-500/15 text-violet-300 ring-violet-500/30",
  Арендатор: "bg-teal-500/15 text-teal-300 ring-teal-500/30",
  "Кросс-промо": "bg-fuchsia-500/15 text-fuchsia-300 ring-fuchsia-500/30",
};

export function advertiserTypeStyle(t?: string | null): string {
  return (t && ADVERTISER_TYPE_STYLES[t]) || "bg-ink-600/50 text-ink-200 ring-ink-500/50";
}

export const TASK_KIND_EMOJI: Record<string, string> = {
  Юрист: "⚖️",
  Дизайн: "🎨",
  Менеджер: "📋",
  Бухгалтерия: "🧮",
  ОРД: "🏷️",
  Прочее: "•",
};

export function nextStages(stage: DealStage, all: readonly string[]): string[] {
  const idx = all.indexOf(stage);
  return all.slice(idx + 1) as string[];
}

// ── Турнирный контур (кабинет Артёма) ────────────────────────────────────────
export const CONTRACTOR_STATUS_STYLES: Record<string, string> = {
  Лид: "bg-ink-600/50 text-ink-100 ring-ink-500/50",
  Переговоры: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  Согласование: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  Подтверждён: "bg-indigo-500/15 text-indigo-300 ring-indigo-500/30",
  Проведён: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  Отказ: "bg-red-500/15 text-red-300 ring-red-500/30",
};
export function contractorStatusStyle(s?: string | null): string {
  return (s && CONTRACTOR_STATUS_STYLES[s]) || "bg-ink-600/50 text-ink-200 ring-ink-500/50";
}

export const TOURNAMENT_STATUS_STYLES: Record<string, string> = {
  Планируется: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  Подтверждён: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  Проведён: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  Отменён: "bg-red-500/15 text-red-300 ring-red-500/30",
};
export function tournamentStatusStyle(s?: string | null): string {
  return (s && TOURNAMENT_STATUS_STYLES[s]) || "bg-ink-600/50 text-ink-200 ring-ink-500/50";
}

export const LEAD_STATUS_STYLES: Record<string, string> = {
  Новая: "bg-brand/15 text-brand-200 ring-brand/30",
  "В работе": "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  Квалифицирована: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  Отказ: "bg-ink-600/50 text-ink-300 ring-ink-500/50",
};

export function leadStatusStyle(status?: string | null): string {
  return (status && LEAD_STATUS_STYLES[status]) || "bg-ink-600/50 text-ink-200 ring-ink-500/50";
}
