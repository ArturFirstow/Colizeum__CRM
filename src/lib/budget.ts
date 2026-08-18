// ─────────────────────────────────────────────────────────────────────────────
// Что считается бюджетом сделки — ОДНО определение на весь сервис.
//
// Раньше их было два: главная складывала суммы из медиапланов, а «Оплаты» —
// суммы по договорам. Если у сделки заполнены оба поля и они отличаются,
// два заголовка честно показывали разные числа, и понять, какое из них
// «настоящее», было нельзя.
//
// Договорились так: бюджет — это сумма по договору за весь период. Пока
// договора нет, берём сумму из медиаплана: на ранних стадиях это
// единственная цифра, которая вообще известна.
//
// Закрытые сделки в бюджет не входят: деньги по ним уже отработаны.
// ─────────────────────────────────────────────────────────────────────────────

export type BudgetDeal = {
  stage: string;
  amount: number | null;
  contractTotal: number | null;
  vatIncluded: boolean;
  contractDate: Date | string | null;
};

/** Строка для подсчёта: сумма сделки и всё, что нужно для НДС. */
export type MoneyRowInput = {
  amount: number | null;
  vatIncluded: boolean;
  date: Date | string | null;
};

export const CLOSED_STAGE = "Закрытие";

/** Активна ли сделка для бюджета. */
export function isActiveForBudget(deal: { stage: string }): boolean {
  return deal.stage !== CLOSED_STAGE;
}

/** Сумма одной сделки: договор, а если его нет — медиаплан. */
export function dealBudgetAmount(deal: BudgetDeal): number | null {
  return deal.contractTotal ?? deal.amount;
}

/** Строка одной сделки для `sumMoney`. */
export function dealBudgetRow(deal: BudgetDeal): MoneyRowInput {
  return {
    amount: dealBudgetAmount(deal),
    vatIncluded: deal.vatIncluded,
    date: deal.contractDate,
  };
}

/** Строки по активным сделкам — то, из чего складывается общий бюджет. */
export function budgetRows(deals: BudgetDeal[]): MoneyRowInput[] {
  return deals.filter(isActiveForBudget).map(dealBudgetRow);
}

/** Подпись под цифрой — одна и та же на всех экранах. */
export const BUDGET_LABEL = "Бюджет по активным сделкам";
export const BUDGET_HINT =
  "суммы по договорам, а где договора ещё нет — из медиапланов; закрытые сделки не считаются";
