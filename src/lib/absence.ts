import type { AbsenceKind } from "@/lib/enums";

// Общее для календаря отпусков: и серверу (API), и сетке в браузере.

/**
 * «2026-08-10» → 10 августа 2026, начало дня по местному времени.
 * Через `new Date("2026-08-10")` нельзя: строка без времени читается как UTC,
 * и отпуск с 1-го числа уезжает на 30-е предыдущего месяца.
 */
export function dayStart(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Цвет полосы в сетке — тип отсутствия должен читаться без легенды. */
export const ABSENCE_BAR: Record<AbsenceKind, string> = {
  Отпуск: "bg-brand/80 text-ink-950",
  Больничный: "bg-rose-500/70 text-ink-50",
  Командировка: "bg-sky-500/70 text-ink-50",
  Отгул: "bg-ink-500/70 text-ink-50",
};
