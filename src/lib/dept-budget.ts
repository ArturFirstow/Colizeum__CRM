// Формулы бюджета отдела — ровно как в рабочей Google-таблице.
// Пользователь вводит сырые данные; всё остальное считается здесь.

export type ExpenseRow = {
  id: string;
  month: string;
  department: string | null;
  category: string | null;
  accountingSub: string | null;
  legalEntity: string | null;
  title: string;
  periodicity: string | null;
  vatRate: number;
  amountTotal: number;
  spentTotal: number | null;
  payFormat: string | null;
  payDate: string | Date | null;
  deliveryDate: string | Date | null;
  serviceEndDate: string | Date | null;
  actClosedDate: string | Date | null;
  justification: string | null;
  description: string | null;
  status: string;
};

/** Сумма без НДС: при 22 % делим на 1,22; иначе равна сумме. */
export function netOfExpense(amountTotal: number, vatRate: number): number {
  return vatRate === 22 ? Math.round(amountTotal / 1.22) : amountTotal;
}

/** НДС = сумма − сумма без НДС. */
export function vatOfExpense(amountTotal: number, vatRate: number): number {
  return amountTotal - netOfExpense(amountTotal, vatRate);
}

/** Разница в днях между оплатой и поставкой (может быть отрицательной). */
export function daysBetween(payDate: string | Date | null, deliveryDate: string | Date | null): number | null {
  if (!payDate || !deliveryDate) return null;
  const p = new Date(payDate).getTime();
  const d = new Date(deliveryDate).getTime();
  return Math.round((d - p) / 86_400_000);
}

/** Обоснование обязательно, если оплата и поставка расходятся > 2 недель. */
export function needsJustification(payDate: string | Date | null, deliveryDate: string | Date | null): boolean {
  const days = daysBetween(payDate, deliveryDate);
  return days != null && Math.abs(days) > 14;
}

/** Неделя месяца по дате оплаты (1–4). */
export function weekOfMonth(payDate: string | Date | null): 1 | 2 | 3 | 4 | null {
  if (!payDate) return null;
  const day = new Date(payDate).getDate();
  return (Math.min(3, Math.floor((day - 1) / 7)) + 1) as 1 | 2 | 3 | 4;
}

/** Итоговая шапка месяца — как блок-сводка над реестром в таблице. */
export function monthSummary(rows: ExpenseRow[]) {
  const approved = rows.filter((r) => r.status === "Согласовано" || r.status === "Оплачено");
  const notApproved = rows.filter((r) => r.status === "Не согласовано");
  const withVat = approved.filter((r) => r.vatRate > 0);
  const withoutVat = approved.filter((r) => r.vatRate === 0);
  const sum = (xs: ExpenseRow[]) => xs.reduce((s, r) => s + r.amountTotal, 0);

  const weeks = [0, 0, 0, 0];
  for (const r of approved) {
    const w = weekOfMonth(r.payDate);
    if (w) weeks[w - 1] += r.amountTotal;
  }

  return {
    approvedTotal: sum(approved),
    withVatTotal: sum(withVat),
    withoutVatTotal: sum(withoutVat),
    vatTotal: approved.reduce((s, r) => s + vatOfExpense(r.amountTotal, r.vatRate), 0),
    notApprovedTotal: sum(notApproved),
    spentTotal: rows.reduce((s, r) => s + (r.spentTotal ?? 0), 0),
    weeks,
  };
}
