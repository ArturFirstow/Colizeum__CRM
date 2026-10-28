// Форматирование для UI (валюта, даты, размеры).

const rub = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

export function formatMoney(amount?: number | null, currency = "RUB"): string {
  if (amount == null) return "—";
  if (currency !== "RUB") {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  }
  return rub.format(amount);
}

/** Число с разделителями разрядов: 30000 → «30 000». */
const num = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
export function formatNumber(value?: number | null): string {
  if (value == null) return "—";
  return num.format(value);
}

/** Чистая сумма без НДС из суммы с НДС (по умолчанию 22 %). */
export function netOfVat(gross?: number | null, ratePercent = 22): number | null {
  if (gross == null) return null;
  return Math.round(gross / (1 + ratePercent / 100));
}

export function formatDate(date?: Date | string | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatDateTime(date?: Date | string | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatBytes(bytes?: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} Б`;
  const units = ["КБ", "МБ", "ГБ"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[i]}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** Относительное «сколько дней назад/до». */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Склонение существительного при числе: 1 сделка, 2 сделки, 5 сделок.
 *
 * Нужно, потому что «1 сделок» и «2 документ» в карточках читаются как
 * недоделка. Формы передаются в порядке: одна, две, пять.
 */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod100 = Math.abs(n) % 100;
  const mod10 = mod100 % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}
