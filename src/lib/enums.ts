// ─────────────────────────────────────────────────────────────────────────────
// Перечисления домена (блупринт, раздел 5 и 7).
// SQLite не поддерживает native enum, поэтому в БД это String, а здесь —
// зафиксированный набор значений + метки/цвета для UI. Единый источник правды.
// ─────────────────────────────────────────────────────────────────────────────

export const ROLES = ["Owner", "Manager"] as const;
export type Role = (typeof ROLES)[number];

export const ADVERTISER_TYPES = [
  "Рекламодатель",
  "Агентство",
  "Арендатор",
  "Кросс-промо",
] as const;
export type AdvertiserType = (typeof ADVERTISER_TYPES)[number];

// Канон стадий сделки — 9 (v2, п.1.1). Единственная шкала во всём сервисе.
export const DEAL_STAGES = [
  "Лид",
  "КП / условия",
  "Договор",
  "Приложение / спец.",
  "Предоплата",
  "Материалы + ОРД",
  "Размещение",
  "УПД + отчёт",
  "Закрытие",
] as const;
export type DealStage = (typeof DEAL_STAGES)[number];

export const STAGE_INDEX: Record<DealStage, number> = DEAL_STAGES.reduce(
  (acc, s, i) => ({ ...acc, [s]: i }),
  {} as Record<DealStage, number>,
);

// Конструкции договоров по убыванию частоты (v2, п.3.5).
export const CONTRACT_CONSTRUCTIONS = [
  { code: "A", label: "Рамочный + спецификации/приложения", example: "самый популярный" },
  { code: "B", label: "Единый договор оказания услуг", example: "реже" },
  { code: "C", label: "Агентский договор", example: "Киберадверт" },
  { code: "D", label: "Допсоглашение (ДС)", example: "изменение условий" },
  { code: "E", label: "Рамочный + заказы", example: "МТС" },
] as const;
export type ContractConstruction = "A" | "B" | "C" | "D" | "E";

// Срочность (v2, п.1.3).
export const URGENCIES = [
  "Максимальная",
  "Высокая",
  "Средняя",
  "Низкая",
  "По запросу",
  "Разово",
] as const;
export type Urgency = (typeof URGENCIES)[number];

// 4 актуальных флага «на выверку» (v2, п.1.7). Ровно эти четыре.
export const VERIFY_FLAGS = [
  "КПП МТС (ПАО) разный в документах: 770901001 / 997750001 — сверять по документу.",
  "Алабуга: канон суммы 9 955 200 ₽; в старых текстах опечатки 9 995 200 / 9 555 200 — проследить в финальном ДС.",
  "Нумерация терминов в договорах иногда сбоит (два «1.3») — вычитывать.",
  "Директория людей: две «Миланы», неоднозначный @izovsehsil13.",
] as const;

export const DOCUMENT_TYPES = [
  "Договор",
  "Приложение",
  "Спецификация",
  "Заказ",
  "ДС",
  "КП",
  "Медиаплан",
  "Счёт",
  "Платёжное поручение",
  "УПД",
  "Отчёт об оказанных услугах",
  "Акт сверки",
  "Правила акции",
  "Креатив",
  "NDA/Согласие",
  "Прочее",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

// Жёсткая иерархия подразделов хранилища (ТЗ, раздел 6).
// Показываем ВСЕ разделы всегда, даже пустые (допускается неполный комплект).
export const DOCUMENT_SECTIONS = [
  { key: "Договоры", types: ["Договор"] },
  { key: "Приложения к договору", types: ["Приложение", "Спецификация", "Заказ"] },
  { key: "Доп. соглашения", types: ["ДС"] },
  { key: "Счета и УПД", types: ["Счёт", "УПД", "Платёжное поручение", "Акт сверки"] },
  { key: "Медиапланы и КП", types: ["Медиаплан", "КП"] },
  { key: "Креативы и макеты", types: ["Креатив", "NDA/Согласие"] },
  { key: "Отчёты", types: ["Отчёт об оказанных услугах"] },
  { key: "Прочее", types: ["Правила акции", "Прочее"] },
] as const;
export type DocumentSection = (typeof DOCUMENT_SECTIONS)[number]["key"];

export function sectionForDocType(type: string): DocumentSection {
  const s = DOCUMENT_SECTIONS.find((sec) => (sec.types as readonly string[]).includes(type));
  return (s?.key ?? "Прочее") as DocumentSection;
}

export const TASK_KINDS = [
  "Юрист",
  "Дизайн",
  "Менеджер",
  "Бухгалтерия",
  "ОРД",
  "Прочее",
] as const;
export type TaskKind = (typeof TASK_KINDS)[number];

export const TASK_STATUSES = ["Открыта", "В работе", "Ждёт", "Готова"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const ORD_ROLES = [
  "Агентство",
  "Клиент",
  "Рекламораспространитель",
  "Рекламодатель",
] as const;
export type OrdRole = (typeof ORD_ROLES)[number];

export const PLANNED_PAYMENT_STATUSES = ["План", "Оплачено", "Просрочено"] as const;
export type PlannedPaymentStatus = (typeof PLANNED_PAYMENT_STATUSES)[number];

// Статусы брони как в рабочей Google-таблице клиента.
export const PLACEMENT_STATUSES = ["Ожидание", "На подписании", "Подписан", "Завершено"] as const;
export type PlacementStatus = (typeof PLACEMENT_STATUSES)[number];

// Типовые слоты/форматы (строки календаря) — из рабочей таблицы клиента.
export const PLACEMENT_SLOTS = [
  "Слот 1 (ПК ТВ + слайдер + ЛК)",
  "Слот 2 (ПК ТВ + слайдер + ЛК)",
  "Слот 3 (ПК ТВ + слайдер + ЛК)",
  "Слот 4 (ПК ТВ + слайдер + ЛК)",
  "Слот 5 (ПК ТВ + слайдер + ЛК)",
  "Слот 6 (ПК ТВ + слайдер + ЛК)",
  "Турнирный календарь",
  "Баннер в мобильном приложении",
  "Автозапуск в браузере",
  "Ярлык на рабочем столе",
] as const;

export const PROMO_MECHANICS = ["Performance", "Acquisition"] as const;
export type PromoMechanic = (typeof PROMO_MECHANICS)[number];

export const MONETIZATIONS = ["Деньги", "Бартер"] as const;
export type Monetization = (typeof MONETIZATIONS)[number];

export const CLOSING_KINDS = ["УПД", "Отчёт", "АктСверки"] as const;
export type ClosingKind = (typeof CLOSING_KINDS)[number];

export const JOURNAL_SOURCES = ["EOD", "Транскрипт", "Чат"] as const;
export type JournalSource = (typeof JOURNAL_SOURCES)[number];

export const JOURNAL_ROUTES = ["Трекер", "База", "Архив"] as const;
export type JournalRoute = (typeof JOURNAL_ROUTES)[number];

// Категории базы знаний (блупринт 5.2).
export const KNOWLEDGE_CATEGORIES = [
  "Материалы для клиента",
  "Профиль",
  "Форматы",
  "Цены/скидки",
  "Условия и согласование",
  "Размещение по каналам",
  "Дизайн-процесс",
  "Документооборот",
  "ОРД",
  "Промокоды",
  "CRM-правила",
  "Аналитика",
  "Люди",
  "Бенчмарки",
  "Кейсы",
  "Дистрибуция",
  "Langame",
  "Отчётность",
  "Финансы/документооборот",
  "Платежи/интеграции",
] as const;
export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];

// НДС по дате документа (блупринт 2, 7.3).
export function vatRateForDate(date: Date = new Date()): number {
  return date.getFullYear() >= 2026 ? 22 : 20;
}
