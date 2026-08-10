import { AD_FORMATS, type AdFormat } from "@/lib/enums";

// ─────────────────────────────────────────────────────────────────────────────
// Шаблоны запросов: юристу на договор и на размещение макетов в клубе.
//
// Порядок в жизни такой: сначала юрист готовит договор и спецификацию, потом,
// когда всё подписано и оплачено, уходит запрос на размещение макетов. Поэтому
// и кнопок две, и вторая говорит вслух, если предоплаты ещё не было.
//
// Тексты собираются из карточки сделки и клиента — руками ничего перепечатывать
// не нужно. Результат кладётся в буфер обмена и вставляется в письмо или чат.
//
// ⚠️ Формулировки — рабочий черновик по правилам документооборота из базы
// знаний. Если у юриста принят свой оборот, правьте прямо здесь: это обычный
// текст, разметки в нём нет.
// ─────────────────────────────────────────────────────────────────────────────

export type RequestDeal = {
  title: string;
  contractNumber?: string | null;
  contractDate?: Date | string | null;
  contractConstruction?: string | null;
  dealType?: string | null;
  finalBrand?: string | null;
  amount?: number | null;
  contractTotal?: number | null;
  vatIncluded: boolean;
  periodText?: string | null;
  launchDate?: Date | string | null;
  paymentTerms?: string | null;
  legalResponsible?: string | null;
  advertiser: {
    nameRu: string;
    legalEntity?: string | null;
    inn?: string | null;
    kpp?: string | null;
    ogrn?: string | null;
    address?: string | null;
    signatory?: string | null;
  };
};

/** Что человек отметил в форме запроса юристу. */
export type LegalRequestInput = {
  formats: string[];
  /** Что размещаем: период и объём словами. */
  period: string;
  /** Сумма договора, если отличается от той, что в сделке. */
  amountText: string;
  /** Особые условия: рассрочка, бартер, эксклюзив и прочее. */
  specialTerms: string;
  /** Срок, к которому нужен документ. */
  dueDate: string;
  comment: string;
};

/** Что человек отметил в форме запроса на размещение. */
export type PlacementRequestInput = {
  formats: string[];
  startDate: string;
  endDate: string;
  /** Где лежат макеты (ссылка на папку или «во вложении»). */
  materials: string;
  /** ЕРИД, если маркировка уже получена. */
  erid: string;
  comment: string;
};

function money(amount?: number | null, vatIncluded = true): string | null {
  if (amount == null) return null;
  const num = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(amount);
  return `${num} ₽ ${vatIncluded ? "с НДС" : "без НДС"}`;
}

function date(value?: Date | string | null): string | null {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("ru-RU");
}

function findFormat(label: string): AdFormat | undefined {
  return AD_FORMATS.find((f) => f.label === label);
}

/** Строка формата для списка: с пометкой про маркировку и особыми условиями. */
function formatLine(label: string): string {
  const f = findFormat(label);
  const marks = [f?.needsOrd ? "нужна маркировка ЕРИД" : null, f?.note].filter(Boolean);
  return `— ${label}${marks.length ? ` (${marks.join("; ")})` : ""}`;
}

/** Есть ли среди отмеченного хоть один интернет-формат. */
export function needsOrdMarking(formats: string[]): boolean {
  return formats.some((label) => findFormat(label)?.needsOrd);
}

// ── Запрос юристу на формирование договора ───────────────────────────────────

export function buildLegalRequest(deal: RequestDeal, input: LegalRequestInput): string {
  const a = deal.advertiser;
  const lines: string[] = [];

  lines.push("Запрос на подготовку договора и спецификации");
  lines.push("");
  lines.push(`Клиент: ${a.nameRu}`);
  if (a.legalEntity) lines.push(`Юридическое лицо: ${a.legalEntity}`);

  const req = [
    a.inn ? `ИНН ${a.inn}` : null,
    a.kpp ? `КПП ${a.kpp}` : null,
    a.ogrn ? `ОГРН ${a.ogrn}` : null,
  ].filter(Boolean);
  if (req.length) lines.push(`Реквизиты: ${req.join(", ")}`);
  if (a.address) lines.push(`Юридический адрес: ${a.address}`);
  if (a.signatory) lines.push(`Подписант со стороны клиента: ${a.signatory}`);

  lines.push("");
  lines.push(`Сделка: ${deal.title}`);
  if (deal.dealType) lines.push(`Тип сделки: ${deal.dealType}`);
  if (deal.finalBrand) lines.push(`Конечный бренд: ${deal.finalBrand}`);
  if (deal.contractConstruction) {
    lines.push(`Конструкция договора: ${deal.contractConstruction}`);
  }
  if (deal.contractNumber) {
    lines.push(
      `Действующий договор: № ${deal.contractNumber}${
        date(deal.contractDate) ? ` от ${date(deal.contractDate)}` : ""
      } — спецификация оформляется к нему`,
    );
  }

  lines.push("");
  lines.push("Что размещаем:");
  if (input.formats.length === 0) {
    lines.push("— (форматы не выбраны)");
  } else {
    for (const label of input.formats) lines.push(formatLine(label));
  }

  lines.push("");
  const amount = input.amountText.trim() || money(deal.contractTotal ?? deal.amount, deal.vatIncluded);
  if (amount) lines.push(`Сумма: ${amount}`);
  const period = input.period.trim() || deal.periodText;
  if (period) lines.push(`Период размещения: ${period}`);
  if (deal.paymentTerms) lines.push(`Условия оплаты: ${deal.paymentTerms}`);
  if (input.specialTerms.trim()) lines.push(`Особые условия: ${input.specialTerms.trim()}`);

  if (needsOrdMarking(input.formats)) {
    lines.push("");
    lines.push(
      "В договоре нужны условия по маркировке: среди форматов есть интернет-размещения, " +
        "по ним получаем ЕРИД и сдаём отчётность в ОРД.",
    );
  }

  if (input.comment.trim()) {
    lines.push("");
    lines.push(`Комментарий: ${input.comment.trim()}`);
  }

  lines.push("");
  if (input.dueDate.trim()) {
    lines.push(`Просьба подготовить документ к ${input.dueDate.trim()}.`);
  } else {
    lines.push("Просьба подготовить документ.");
  }
  lines.push("После вашей правки отправляем на согласование главному бухгалтеру.");

  return lines.join("\n");
}

// ── Запрос на размещение макетов в клубе ─────────────────────────────────────

export function buildPlacementRequest(deal: RequestDeal, input: PlacementRequestInput): string {
  const a = deal.advertiser;
  const lines: string[] = [];

  lines.push("Запрос на размещение рекламных макетов");
  lines.push("");
  lines.push(`Клиент: ${a.nameRu}`);
  if (deal.finalBrand) lines.push(`Бренд в макетах: ${deal.finalBrand}`);
  lines.push(`Сделка: ${deal.title}`);
  if (deal.contractNumber) {
    lines.push(
      `Основание: договор № ${deal.contractNumber}${
        date(deal.contractDate) ? ` от ${date(deal.contractDate)}` : ""
      }`,
    );
  }

  lines.push("");
  lines.push("Форматы к размещению:");
  if (input.formats.length === 0) {
    lines.push("— (форматы не выбраны)");
  } else {
    for (const label of input.formats) lines.push(formatLine(label));
  }

  lines.push("");
  const start = input.startDate.trim() || date(deal.launchDate);
  if (start && input.endDate.trim()) {
    lines.push(`Период размещения: с ${start} по ${input.endDate.trim()}`);
  } else if (start) {
    lines.push(`Дата запуска: ${start}`);
  } else if (deal.periodText) {
    lines.push(`Период размещения: ${deal.periodText}`);
  }

  lines.push(`Макеты: ${input.materials.trim() || "во вложении"}`);

  if (needsOrdMarking(input.formats)) {
    lines.push("");
    if (input.erid.trim()) {
      lines.push(`Маркировка: ЕРИД ${input.erid.trim()} — нанести на креатив.`);
    } else {
      lines.push(
        "Маркировка: среди форматов есть интернет-размещения — ЕРИД ещё не получен, " +
          "размещение стартует только после маркировки.",
      );
    }
  }

  lines.push("");
  lines.push(
    "Макеты проверены по техническим требованиям, ко-брендинг «Бренд × COLIZEUM» — в верхней зоне.",
  );

  if (input.comment.trim()) {
    lines.push("");
    lines.push(`Комментарий: ${input.comment.trim()}`);
  }

  return lines.join("\n");
}
