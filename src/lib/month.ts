// Работа с месяцем в виде строки «ГГГГ-ММ» — так периоды лежат в базе
// (PlannedPayment.periodMonth) и приходят из <input type="month">.
//
// Эти четыре функции были скопированы в календаре платежей и в его окне, а
// теперь их читает ещё и график — третья копия точно разъехалась бы с первыми
// двумя.

export const MONTHS_RU = [
  "янв",
  "фев",
  "мар",
  "апр",
  "май",
  "июн",
  "июл",
  "авг",
  "сен",
  "окт",
  "ноя",
  "дек",
] as const;

/** «2026-10» → «окт 26». */
export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS_RU[(m ?? 1) - 1]} ${String(y).slice(2)}`;
}

/** «2026-10» ± N месяцев → «2027-01». */
export function shiftMonthStr(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, (m ?? 1) - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Все месяцы от первого до последнего включительно (без пропусков). */
export function monthRange(from: string, to: string): string[] {
  if (!from || !to || from > to) return from ? [from] : [];
  const out: string[] = [];
  let cur = from;
  // Предел на всякий случай: испорченная дата не должна крутить цикл вечно.
  for (let i = 0; i < 240 && cur <= to; i++) {
    out.push(cur);
    cur = shiftMonthStr(cur, 1);
  }
  return out;
}

/** Текущий месяц по часам браузера/сервера. */
export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/** Короткая сумма для тесных клеток: «3,54 млн», «250 тыс». */
export function compactMoney(amount: number): string {
  const sign = amount < 0 ? "−" : "";
  const a = Math.abs(amount);
  // «20,00 млн» на шкале читается хуже, чем «20 млн»; дробную часть пишем,
  // только когда она есть.
  if (a >= 1_000_000)
    return `${sign}${(a / 1_000_000).toFixed(2).replace(/\.?0+$/, "").replace(".", ",")} млн`;
  if (a >= 1_000) return `${sign}${Math.round(a / 1000)} тыс`;
  return `${sign}${a}`;
}

/** Полные названия — для выпадающего списка, где «окт» читается хуже. */
export const MONTHS_RU_FULL = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
] as const;
