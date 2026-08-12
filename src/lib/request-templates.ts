import { AD_FORMATS, vatRateForDate, type AdFormat } from "@/lib/enums";

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

// ── Справочники для выпадающих списков в формах ───────────────────────────────

/** География размещения. Список согласован с пользователем, не выдумывать. */
export const GEO_OPTIONS = ["Все клубы РФ", "Клубы Москвы и Московской области", "Другое"] as const;

/** Кто готовит макеты. */
export const CREATIVE_OWNERS = ["COLIZEUM", "Клиент"] as const;

/** Кто получает рекламную маркировку (ЕРИД). */
export const ERID_OWNERS = ["COLIZEUM", "Клиент"] as const;

/** Где подписываем документы. */
export const SIGNING_OPTIONS = ["ЭДО", "На бумаге"] as const;

/** Схема оплаты. */
export const PAYMENT_SCHEMES = ["100% предоплата", "50% / 50%", "Другое"] as const;

/** Что человек отметил в форме запроса юристу. */
export type LegalRequestInput = {
  formats: string[];
  /** Период размещения — даты из календаря, «2026-09-01». */
  startDate: string;
  endDate: string;
  /** Чистая сумма договора без НДС, как её ввели руками. */
  amountNet: string;
  /** Ставка НДС в процентах — по дате договора (2025 → 20, 2026 → 22). */
  vatRate: number;
  geo: string;
  /** Если гео «Другое» — что именно. */
  geoOther: string;
  creativesBy: string;
  eridBy: string;
  signing: string;
  paymentScheme: string;
  /** Если схема оплаты «Другое» — как именно. */
  paymentOther: string;
  /** Делать ли отдельное приложение под интернет-форматы. */
  secondAppendix: boolean;
  specialTerms: string;
  comment: string;
};

/** Что человек отметил в форме запроса на размещение. */
export type PlacementRequestInput = {
  formats: string[];
  /**
   * Ссылки клиента по форматам: в кликабельные баннеры вшивается UTM-ссылка,
   * в статичные — ссылка, которую зашивают в QR-код. Ключ — название формата.
   */
  links: Record<string, string>;
  /** Даты из календаря, «2026-09-01». */
  startDate: string;
  endDate: string;
  /** Где лежат макеты (ссылка на папку или «во вложении»). */
  materials: string;
  /** ЕРИД, если маркировка уже получена. */
  erid: string;
  comment: string;
};

// ── Мелкие помощники ─────────────────────────────────────────────────────────

function rub(value: number): string {
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.round(value))} ₽`;
}

function money(amount?: number | null, vatIncluded = true): string | null {
  if (amount == null) return null;
  return `${rub(amount)} ${vatIncluded ? "с НДС" : "без НДС"}`;
}

function date(value?: Date | string | null): string | null {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("ru-RU");
}

/** «2026-09-01» из календаря → «01.09.2026». */
function fromInput(iso: string): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return null;
  return `${d}.${m}.${y}`;
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

/** Интернет-форматы из отмеченного — они уходят во второе приложение. */
export function internetFormats(formats: string[]): string[] {
  return formats.filter((label) => findFormat(label)?.needsOrd);
}

/** Форматы в клубах — первое приложение. */
export function clubFormats(formats: string[]): string[] {
  return formats.filter((label) => !findFormat(label)?.needsOrd);
}

/**
 * Сумма с НДС по чистой сумме. Одно место на весь сервис, где живёт эта
 * арифметика в запросах: 100 000 без НДС при ставке 22 % → 122 000 с НДС.
 */
export function withVat(net: number, rate: number): number {
  return net * (1 + rate / 100);
}

/** Ставка НДС для сделки: по дате договора, а если её нет — по сегодняшней. */
export function vatRateForDeal(deal: RequestDeal): number {
  const d = deal.contractDate ? new Date(deal.contractDate) : new Date();
  return vatRateForDate(Number.isNaN(d.getTime()) ? new Date() : d);
}

/**
 * Чистая сумма для подстановки в форму: в сделке сумма может лежать и с НДС,
 * и без — смотрим на флажок и приводим к «без НДС».
 */
export function netAmountOfDeal(deal: RequestDeal, rate: number): number | null {
  const total = deal.contractTotal ?? deal.amount;
  if (total == null) return null;
  return deal.vatIncluded ? total / (1 + rate / 100) : total;
}

/** Строка про деньги в едином виде по всему сервису: с НДС, чистая — подписью. */
function moneyLines(input: LegalRequestInput): string[] {
  const net = Number(input.amountNet.replace(/\s/g, "").replace(",", "."));
  if (!input.amountNet.trim() || !Number.isFinite(net) || net <= 0) return [];
  const gross = withVat(net, input.vatRate);
  return [
    `Сумма договора: ${rub(gross)} с НДС ${input.vatRate}%`,
    `В том числе НДС ${input.vatRate}%: ${rub(gross - net)}`,
    `Сумма без НДС: ${rub(net)}`,
  ];
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

  // География — юристу нужна для предмета договора.
  const geo = input.geo === "Другое" ? input.geoOther.trim() : input.geo;
  if (geo) lines.push(`География размещения: ${geo}`);

  // ── Форматы. Интернет-форматы отделяются во второе приложение, потому что
  // по ним идёт маркировка и отчётность в ОРД, а у клубных форматов её нет.
  const club = clubFormats(input.formats);
  const internet = internetFormats(input.formats);
  const splitAppendices = input.secondAppendix && internet.length > 0;

  lines.push("");
  if (input.formats.length === 0) {
    lines.push("Что размещаем:");
    lines.push("— (форматы не выбраны)");
  } else if (splitAppendices) {
    lines.push("Приложение № 1 — размещение в клубах:");
    if (club.length === 0) {
      lines.push("— (клубных форматов в этой сделке нет)");
    } else {
      for (const label of club) lines.push(formatLine(label));
    }
    lines.push("");
    lines.push("Приложение № 2 — интернет-размещение (с маркировкой ЕРИД):");
    for (const label of internet) lines.push(formatLine(label));
    lines.push("");
    lines.push(
      "Просьба оформить двумя приложениями: по интернет-форматам ведётся маркировка и " +
        "отчётность в ОРД, по клубным форматам — нет, и разносить их в одном приложении неудобно.",
    );
  } else {
    lines.push("Что размещаем:");
    for (const label of input.formats) lines.push(formatLine(label));
  }

  // ── Сроки и деньги.
  lines.push("");
  const start = fromInput(input.startDate);
  const end = fromInput(input.endDate);
  if (start && end) {
    lines.push(`Период размещения: с ${start} по ${end}`);
  } else if (start) {
    lines.push(`Начало размещения: ${start}`);
  } else if (deal.periodText) {
    lines.push(`Период размещения: ${deal.periodText}`);
  }

  const moneys = moneyLines(input);
  if (moneys.length) {
    lines.push(...moneys);
  } else {
    const fallback = money(deal.contractTotal ?? deal.amount, deal.vatIncluded);
    if (fallback) lines.push(`Сумма договора: ${fallback}`);
  }

  const payment =
    input.paymentScheme === "Другое" ? input.paymentOther.trim() : input.paymentScheme;
  if (payment) lines.push(`Порядок оплаты: ${payment}`);
  else if (deal.paymentTerms) lines.push(`Порядок оплаты: ${deal.paymentTerms}`);

  // ── Кто что делает: три вопроса, из-за которых договор обычно возвращают.
  lines.push("");
  if (input.creativesBy) lines.push(`Макеты готовит: ${input.creativesBy}`);
  if (internet.length > 0 && input.eridBy) {
    lines.push(`Рекламную маркировку (ЕРИД) получает: ${input.eridBy}`);
  }
  if (input.signing) lines.push(`Подписание документов: ${input.signing}`);

  if (input.specialTerms.trim()) lines.push(`Особые условия: ${input.specialTerms.trim()}`);

  if (internet.length > 0) {
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

  // Форматы со ссылками: в кликабельные вшивается UTM клиента, в статичные —
  // ссылка под QR-код. Без ссылки формат уедет в клуб «немым», поэтому пишем
  // её прямо под форматом, а не одной строкой на весь запрос.
  lines.push("");
  lines.push("Форматы к размещению:");
  if (input.formats.length === 0) {
    lines.push("— (форматы не выбраны)");
  } else {
    for (const label of input.formats) {
      lines.push(formatLine(label));
      const link = (input.links[label] ?? "").trim();
      if (link) lines.push(`   ссылка: ${link}`);
    }
  }

  lines.push("");
  const start = fromInput(input.startDate) ?? date(deal.launchDate);
  const end = fromInput(input.endDate);
  if (start && end) {
    lines.push(`Период размещения: с ${start} по ${end}`);
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
