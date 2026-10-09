import "server-only";
import { prisma } from "@/lib/prisma";
import { iso, type Shape } from "@/lib/services/api-v1";
import type { ApiScope } from "@/lib/services/api-keys";

// ─────────────────────────────────────────────────────────────────────────────
// Что именно отдаёт API — ОДИН список на всё (требования Влада 9.1).
//
// Почему всё в одном месте, а не по файлу на раздел. У публичного API есть
// три вещи, которые обязаны совпадать: что отдаётся на самом деле, что
// написано в машинном описании (OpenAPI) и что видит человек в документации.
// Если их держать порознь, они разъезжаются — сначала незаметно, потом
// коннектор ломается на поле, которого «по описанию» быть не должно.
//
// Здесь они не могут разъехаться: и выдача, и OpenAPI, и описание полей
// строятся из этой таблицы. Добавили поле — оно появилось везде сразу.
// ─────────────────────────────────────────────────────────────────────────────

/** Тип поля для машинного описания. Нарочно скромный набор — больше не нужно. */
export type FieldType = "string" | "number" | "boolean" | "date-time";

export type FieldSpec = {
  type: FieldType;
  /** Пояснение человеку: оно же уходит в OpenAPI. */
  about: string;
  /** Может ли быть пустым. */
  nullable?: boolean;
};

type ListArgs = Parameters<Parameters<typeof import("@/lib/services/api-v1").serveList>[1]["find"]>[0];

/** Любая запись, которую можно отдать: лишь бы был id и дата изменения. */
export type ApiRow = { id: string; updatedAt: Date } & Record<string, unknown>;

export type EntitySpec = {
  scope: ApiScope;
  /** Название раздела по-русски. */
  title: string;
  /** Одной фразой: что это и зачем внешней системе. */
  about: string;
  /** Чему соответствует на стороне Aspro — чтобы коннектор знал, куда класть. */
  asproTarget: string;
  /** Категории данных для журнала передач (без значений). */
  dataKinds: string[];
  fields: Record<string, FieldSpec>;
  find: (args: ListArgs) => Promise<ApiRow[]>;
  count: (where: Record<string, unknown> | undefined) => Promise<number>;
  shape: Shape<ApiRow>;
};

// Поля, которые есть у каждой сущности, — описываем один раз.
const COMMON: Record<string, FieldSpec> = {
  id: { type: "string", about: "Идентификатор записи в сервисе. Постоянный, не меняется." },
  asproId: {
    type: "string",
    nullable: true,
    about:
      "Идентификатор этой же записи на стороне Aspro. Пустой, пока запись туда не ушла; " +
      "заполняет коннектор после первой успешной передачи, чтобы потом обновлять, а не плодить дубли.",
  },
  createdAt: { type: "date-time", about: "Когда запись заведена в сервисе." },
  updatedAt: {
    type: "date-time",
    about: "Когда запись последний раз менялась. По нему работает отбор updatedSince.",
  },
};

// ── Клиенты ──────────────────────────────────────────────────────────────────

const advertisers: EntitySpec = {
  scope: "advertisers",
  title: "Клиенты",
  about: "Рекламодатели и агентства, с которыми работает отдел.",
  asproTarget: "CRM → Контрагенты",
  dataKinds: ["название и реквизиты организации", "подписант", "адрес"],
  fields: {
    ...COMMON,
    nameRu: { type: "string", about: "Название, как его называют в работе." },
    nameEn: { type: "string", nullable: true, about: "Название латиницей, если используется." },
    legalEntity: { type: "string", nullable: true, about: "Юридическое лицо целиком, например «АО «ТБанк»»." },
    type: { type: "string", about: "«Рекламодатель» или «Агентство»." },
    status: { type: "string", about: "Состояние работы с клиентом." },
    archived: { type: "boolean", about: "Убран в архив: работа закончена, запись оставлена для истории." },
    inn: { type: "string", nullable: true, about: "ИНН организации." },
    kpp: { type: "string", nullable: true, about: "КПП." },
    ogrn: { type: "string", nullable: true, about: "ОГРН." },
    address: { type: "string", nullable: true, about: "Юридический адрес." },
    signatory: { type: "string", nullable: true, about: "Кто подписывает документы со стороны клиента." },
    bankName: { type: "string", nullable: true, about: "Банк." },
    bankAccount: { type: "string", nullable: true, about: "Расчётный счёт." },
    bik: { type: "string", nullable: true, about: "БИК." },
    asproUrl: {
      type: "string",
      nullable: true,
      about:
        "Ссылка на бизнес-процесс этой записи в Aspro — её ставит сотрудник руками, " +
        "чтобы из карточки попадать в процесс одним нажатием. Не путать с asproId: " +
        "тот нужен коннектору, эта — человеку.",
    },
  },
  find: (args) => prisma.advertiser.findMany(args),
  count: (where) => prisma.advertiser.count({ where }),
  shape: (x) => {
    return {
      id: x.id,
      asproId: x.asproId,
      nameRu: x.nameRu,
      nameEn: x.nameEn,
      legalEntity: x.legalEntity,
      type: x.type,
      status: x.status,
      archived: x.archived,
      inn: x.inn,
      kpp: x.kpp,
      ogrn: x.ogrn,
      address: x.address,
      signatory: x.signatory,
      bankName: x.bankName,
      bankAccount: x.bankAccount,
      bik: x.bik,
      asproUrl: x.asproUrl,
      createdAt: iso(x.createdAt as Date),
      updatedAt: iso(x.updatedAt as Date),
    };
  },
};

// ── Сделки ───────────────────────────────────────────────────────────────────

const deals: EntitySpec = {
  scope: "deals",
  title: "Сделки",
  about: "Проекты с клиентами: от первого обращения до закрытия.",
  asproTarget: "CRM → Сделка",
  dataKinds: ["название сделки", "стадия", "суммы", "сроки", "номер договора"],
  fields: {
    ...COMMON,
    advertiserId: { type: "string", about: "Идентификатор клиента из раздела advertisers." },
    title: { type: "string", about: "Название сделки." },
    dealType: { type: "string", nullable: true, about: "Прямой клиент, агентство или технический." },
    finalBrand: { type: "string", nullable: true, about: "Конечный бренд, если работаем через агентство." },
    stage: { type: "string", about: "Стадия: Лид, Договор, Оплата, Размещение или Закрытие." },
    urgency: { type: "string", nullable: true, about: "Срочность работы по сделке." },
    amountNet: {
      type: "number",
      nullable: true,
      about:
        "Сумма из медиаплана БЕЗ НДС. В сервисе действует правило «вводим чистую сумму» — " +
        "пересчёт на стороне принимающей системы.",
    },
    contractTotalNet: {
      type: "number",
      nullable: true,
      about: "Сумма по договору за весь период сотрудничества, тоже БЕЗ НДС.",
    },
    currency: { type: "string", about: "Валюта. Обычно RUB." },
    periodText: {
      type: "string",
      nullable: true,
      about:
        "Срок размещения ТЕКСТОМ, а не датами: в работе он часто звучит как «октябрь–ноябрь» " +
        "или «две недели после подписания».",
    },
    launchDate: { type: "date-time", nullable: true, about: "Дата запуска размещения." },
    paymentTerms: { type: "string", nullable: true, about: "Условия оплаты." },
    contractNumber: { type: "string", nullable: true, about: "Номер договора." },
    contractDate: {
      type: "date-time",
      nullable: true,
      about: "Дата договора. От неё зависит ставка НДС: 2025 — 20 %, 2026 — 22 %.",
    },
    blockerActive: { type: "boolean", about: "Поднят ли флажок «работа заблокирована»." },
    asproUrl: {
      type: "string",
      nullable: true,
      about:
        "Ссылка на бизнес-процесс этой записи в Aspro — её ставит сотрудник руками, " +
        "чтобы из карточки попадать в процесс одним нажатием. Не путать с asproId: " +
        "тот нужен коннектору, эта — человеку.",
    },
  },
  find: (args) => prisma.deal.findMany(args),
  count: (where) => prisma.deal.count({ where }),
  shape: (x) => {
    return {
      id: x.id,
      asproId: x.asproId,
      advertiserId: x.advertiserId,
      title: x.title,
      dealType: x.dealType,
      finalBrand: x.finalBrand,
      stage: x.stage,
      urgency: x.urgency,
      amountNet: x.amount,
      contractTotalNet: x.contractTotal,
      currency: x.currency,
      periodText: x.periodText,
      launchDate: iso(x.launchDate as Date | null),
      paymentTerms: x.paymentTerms,
      contractNumber: x.contractNumber,
      contractDate: iso(x.contractDate as Date | null),
      blockerActive: x.blockerActive,
      asproUrl: x.asproUrl,
      createdAt: iso(x.createdAt as Date),
      updatedAt: iso(x.updatedAt as Date),
    };
  },
};

// ── Документы ────────────────────────────────────────────────────────────────

const documents: EntitySpec = {
  scope: "documents",
  title: "Документы",
  about:
    "Карточки документов: договоры, спецификации, акты. Отдаются КАРТОЧКИ, а не файлы — " +
    "содержимое документов за пределы сервиса не уходит.",
  asproTarget: "Документы",
  dataKinds: ["вид и название документа", "привязка к клиенту и сделке"],
  fields: {
    ...COMMON,
    advertiserId: { type: "string", about: "Идентификатор клиента." },
    dealId: { type: "string", nullable: true, about: "Идентификатор сделки, если документ к ней привязан." },
    type: { type: "string", about: "Вид документа: договор, приложение, акт и так далее." },
    title: { type: "string", about: "Название документа." },
  },
  find: (args) => prisma.document.findMany(args),
  count: (where) => prisma.document.count({ where }),
  shape: (x) => {
    return {
      id: x.id,
      asproId: x.asproId,
      advertiserId: x.advertiserId,
      dealId: x.dealId,
      type: x.type,
      title: x.title,
      createdAt: iso(x.createdAt as Date),
      updatedAt: iso(x.updatedAt as Date),
    };
  },
};

// ── Задачи ───────────────────────────────────────────────────────────────────

const tasks: EntitySpec = {
  scope: "tasks",
  title: "Задачи",
  about:
    "Задачи по клиентам и сделкам. Примечания намеренно не отдаются: это свободный текст, " +
    "в котором сотрудники пишут что угодно, включая личное о людях.",
  asproTarget: "Задачи",
  dataKinds: ["название задачи", "срок", "статус", "привязка к клиенту"],
  fields: {
    ...COMMON,
    advertiserId: { type: "string", nullable: true, about: "Идентификатор клиента." },
    dealId: { type: "string", nullable: true, about: "Идентификатор сделки." },
    title: { type: "string", about: "Что нужно сделать." },
    kind: { type: "string", about: "Кому адресована: юрист, дизайн, менеджер, бухгалтерия, ОРД." },
    status: { type: "string", about: "Открыта, в работе, ждёт или готова." },
    priority: { type: "string", about: "Срочно, высокий, обычный или низкий." },
    side: { type: "string", about: "На нашей стороне задача или на стороне клиента." },
    dueDate: { type: "date-time", nullable: true, about: "Срок." },
  },
  find: (args) => prisma.task.findMany(args),
  count: (where) => prisma.task.count({ where }),
  shape: (x) => {
    return {
      id: x.id,
      asproId: x.asproId,
      advertiserId: x.advertiserId,
      dealId: x.dealId,
      title: x.title,
      kind: x.kind,
      status: x.status,
      priority: x.priority,
      side: x.side,
      dueDate: iso(x.dueDate as Date | null),
      createdAt: iso(x.createdAt as Date),
      updatedAt: iso(x.updatedAt as Date),
    };
  },
};

// ── Счета ────────────────────────────────────────────────────────────────────

const invoices: EntitySpec = {
  scope: "invoices",
  title: "Счета",
  about: "Выставленные счета по сделкам.",
  asproTarget: "Счета",
  dataKinds: ["номер и основание счёта", "сумма", "дата выставления"],
  fields: {
    ...COMMON,
    dealId: { type: "string", about: "Идентификатор сделки." },
    number: { type: "string", about: "Номер счёта." },
    basis: { type: "string", nullable: true, about: "Основание: приложение к договору." },
    service: { type: "string", nullable: true, about: "Назначение платежа." },
    amountGross: {
      type: "number",
      nullable: true,
      about:
        "Сумма С НДС — в отличие от сделок, где сумма чистая. Так сделано потому, что сумму счёта " +
        "переписывают с настоящего документа, где налог уже включён.",
    },
    vatRate: { type: "number", nullable: true, about: "Ставка НДС в процентах." },
    appendixNo: { type: "string", nullable: true, about: "Номер приложения." },
    issuedAt: { type: "date-time", nullable: true, about: "Когда счёт выставлен." },
  },
  find: (args) => prisma.invoice.findMany(args),
  count: (where) => prisma.invoice.count({ where }),
  shape: (x) => {
    return {
      id: x.id,
      asproId: x.asproId,
      dealId: x.dealId,
      number: x.number,
      basis: x.basis,
      service: x.service,
      amountGross: x.amount,
      vatRate: x.vatRate,
      appendixNo: x.appendixNo,
      issuedAt: iso(x.issuedAt as Date | null),
      createdAt: iso(x.createdAt as Date),
      updatedAt: iso(x.updatedAt as Date),
    };
  },
};

// ── Контрагенты турниров ─────────────────────────────────────────────────────

const tournamentContractors: EntitySpec = {
  scope: "tournament-contractors",
  title: "Контрагенты турниров",
  about:
    "Заказчики турнирного направления. Содержит имя контактного лица — это персональные данные, " +
    "поэтому раздел открывается ключу отдельным разрешением.",
  asproTarget: "CRM → Контрагенты",
  dataKinds: ["название организации", "имя контактного лица", "его контакт", "статус"],
  fields: {
    ...COMMON,
    name: { type: "string", about: "Компания-заказчик." },
    brand: { type: "string", nullable: true, about: "Бренд, если отличается от названия компании." },
    contactPerson: { type: "string", nullable: true, about: "Контактное лицо." },
    contact: { type: "string", nullable: true, about: "Телефон, почта или телеграм контактного лица." },
    status: { type: "string", about: "Стадия работы: от лида до закрытия." },
  },
  find: (args) => prisma.tournamentContractor.findMany(args),
  count: (where) => prisma.tournamentContractor.count({ where }),
  shape: (x) => {
    return {
      id: x.id,
      asproId: x.asproId,
      name: x.name,
      brand: x.brand,
      contactPerson: x.contactPerson,
      contact: x.contact,
      status: x.status,
      createdAt: iso(x.createdAt as Date),
      updatedAt: iso(x.updatedAt as Date),
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────────

export const API_REGISTRY = {
  advertisers,
  deals,
  documents,
  tasks,
  invoices,
  "tournament-contractors": tournamentContractors,
} as const;

export type RegistryKey = keyof typeof API_REGISTRY;

export function entityByPath(path: string): EntitySpec | undefined {
  return (API_REGISTRY as Record<string, EntitySpec>)[path];
}
