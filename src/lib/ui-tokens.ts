// Цветовые токены для стадий, статусов, типов — единый визуальный язык.
// Возвращаем классы Tailwind (важно: перечислены явно, чтобы не вырезал purge).

import type { DealStage } from "./enums";

export const STAGE_STYLES: Record<string, string> = {
  Лид: "bg-ink-600/50 text-ink-100 ring-ink-500/50",
  "КП / условия": "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  Договор: "bg-indigo-500/15 text-indigo-300 ring-indigo-500/30",
  "Приложение / спец.": "bg-violet-500/15 text-violet-300 ring-violet-500/30",
  Предоплата: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  "Материалы + ОРД": "bg-orange-500/15 text-orange-300 ring-orange-500/30",
  Размещение: "bg-brand/15 text-brand-200 ring-brand/30",
  "УПД + отчёт": "bg-teal-500/15 text-teal-300 ring-teal-500/30",
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

// Проверка «есть ли ⚠️» в тексте (для флагов на выверку, блупринт 16).
export function hasWarningFlag(text?: string | null): boolean {
  return !!text && text.includes("⚠️");
}

export function nextStages(stage: DealStage, all: readonly string[]): string[] {
  const idx = all.indexOf(stage);
  return all.slice(idx + 1) as string[];
}
