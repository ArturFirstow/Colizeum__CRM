import { z } from "zod";
import {
  ADVERTISER_TYPES,
  CLOSING_KINDS,
  DEAL_STAGES,
  DOCUMENT_TYPES,
  JOURNAL_ROUTES,
  JOURNAL_SOURCES,
  KNOWLEDGE_CATEGORIES,
  MONETIZATIONS,
  ORD_ROLES,
  PLACEMENT_STATUSES,
  PLANNED_PAYMENT_STATUSES,
  PROMO_MECHANICS,
  TASK_KINDS,
  TASK_STATUSES,
  URGENCIES,
  TOURNAMENT_CONTRACTOR_STATUSES,
  TOURNAMENT_FORMATS,
  TOURNAMENT_STATUSES,
  ARENA_BOOKING_STATUSES,
  LEAD_STATUSES,
} from "./enums";

/** Zod-схема «значение из фиксированного набора» (замена native enum для SQLite). */
function inSet<T extends readonly string[]>(values: T, message?: string) {
  return z.string().refine((v) => (values as readonly string[]).includes(v), {
    message: message ?? "Недопустимое значение",
  });
}

const optionalString = z.string().trim().optional().or(z.literal("").transform(() => undefined));

export const advertiserCreateSchema = z.object({
  nameRu: z.string().trim().min(1, "Укажите название"),
  nameEn: optionalString,
  legalEntity: optionalString,
  inn: optionalString,
  kpp: optionalString,
  ogrn: optionalString,
  type: inSet(ADVERTISER_TYPES).default("Рекламодатель"),
  status: optionalString,
  goals: optionalString,
  notes: optionalString,
  // реквизиты контрагента
  address: optionalString,
  bankName: optionalString,
  bankAccount: optionalString,
  bik: optionalString,
  signatory: optionalString,
});
export const advertiserUpdateSchema = advertiserCreateSchema.partial().extend({
  archived: z.boolean().optional(),
});

export const creativeCreateSchema = z.object({
  title: z.string().trim().min(1, "Название макета"),
  size: optionalString,
  status: z.enum(["В работе", "На согласовании", "Согласован", "Отклонён"]).optional(),
  dealId: optionalString,
  notes: optionalString,
});
export const creativeUpdateSchema = z.object({
  status: z.enum(["В работе", "На согласовании", "Согласован", "Отклонён"]).optional(),
});

export const agencyClientCreateSchema = z.object({
  name: z.string().trim().min(1, "Укажите клиента"),
  brand: optionalString,
  inn: optionalString,
  notes: optionalString,
});

export const contactCreateSchema = z.object({
  fio: z.string().trim().min(1, "Укажите ФИО"),
  role: optionalString,
  email: optionalString,
  phone: optionalString,
  telegram: optionalString,
  isPrimary: z.boolean().optional().default(false),
});

const dealDate = z.string().optional().or(z.literal("").transform(() => undefined));

export const dealCreateSchema = z.object({
  advertiserId: z.string().min(1),
  title: z.string().trim().min(1, "Укажите название сделки"),
  dealType: optionalString,
  finalBrand: optionalString,
  contractConstruction: z.enum(["A", "B", "C", "D", "E"]).optional(),
  stage: inSet(DEAL_STAGES).optional(),
  urgency: inSet(URGENCIES).optional(),
  ownerId: optionalString,
  assigneeId: optionalString,
  amount: z.number().nonnegative().optional(),
  contractTotal: z.number().nonnegative().optional(),
  vatIncluded: z.boolean().optional(),
  periodText: optionalString,
  launchDate: dealDate,
  paymentTerms: optionalString,
  contractNumber: optionalString,
  legalResponsible: optionalString,
  blocker: optionalString,
  situational: optionalString,
  nextStep: optionalString,
  nextStepDate: dealDate,
  decisionPending: optionalString,
  notes: optionalString,
});

export const dealUpdateSchema = dealCreateSchema.partial().extend({
  // при смене стадии с предупреждениями клиент присылает confirm=true
  confirm: z.boolean().optional(),
});

export const taskCreateSchema = z.object({
  title: z.string().trim().min(1, "Укажите задачу"),
  kind: inSet(TASK_KINDS).default("Менеджер"),
  dealId: optionalString,
  advertiserId: optionalString,
  assigneeId: optionalString,
  status: inSet(TASK_STATUSES).optional(),
  side: z.enum(["Мы", "Клиент"]).optional(),
  dueDate: z.string().datetime().optional().or(z.literal("").transform(() => undefined)),
  notes: optionalString,
});
export const taskUpdateSchema = taskCreateSchema.partial();

// Поручение от руководителя конкретному сотруднику.
export const leadershipTaskSchema = z.object({
  assigneeId: z.string().min(1, "Выберите сотрудника"),
  title: z.string().trim().min(1, "Укажите поручение"),
  kind: inSet(TASK_KINDS).optional(),
  advertiserId: optionalString,
  dueDate: z.string().datetime().optional().or(z.literal("").transform(() => undefined)),
  notes: optionalString,
});

export const documentCreateSchema = z.object({
  advertiserId: z.string().min(1, "Выберите рекламодателя"),
  dealId: optionalString,
  type: inSet(DOCUMENT_TYPES, "Выберите тип документа"),
  title: z.string().trim().min(1, "Укажите название документа"),
});

export const knowledgeCreateSchema = z.object({
  // Категория — свободная строка: помимо стандартных, можно создавать новые
  // категории прямо из формы «+ Статья» (ТЗ р.2, п.6).
  category: z.string().trim().min(1, "Укажите категорию"),
  title: z.string().trim().min(1),
  bodyMarkdown: z.string().default(""),
  notes: optionalString,
});
export const knowledgeUpdateSchema = knowledgeCreateSchema.partial();

export const journalCreateSchema = z.object({
  source: inSet(JOURNAL_SOURCES).default("EOD"),
  rawText: z.string().trim().min(1, "Пустая запись"),
  routedTo: inSet(JOURNAL_ROUTES).optional(),
  parsedSummary: optionalString,
  meetingWith: optionalString,
  advertiserId: optionalString,
});

export const mediaPlanCreateSchema = z.object({
  version: z.number().int().positive().optional(),
  totalAmount: z.number().nonnegative().optional(),
  vatRate: z.number().int().optional(),
  reachTotal: z.number().int().optional(),
  notes: optionalString,
  lines: z
    .array(
      z.object({
        formatCode: optionalString,
        formatName: z.string().trim().min(1),
        qty: z.number().int().optional(),
        period: optionalString,
        unitPrice: z.number().optional(),
        sum: z.number().optional(),
        reach: z.number().int().optional(),
        geo: optionalString,
      }),
    )
    .optional(),
});

export const ordCreateSchema = z.object({
  role: inSet(ORD_ROLES),
  erid: optionalString,
  finalClient: optionalString,
  platform: optionalString,
  status: optionalString,
  monthlyClosing: z.boolean().optional(),
});

export const promoCreateSchema = z.object({
  mechanic: inSet(PROMO_MECHANICS),
  nominal: z.number().optional(),
  qty: z.number().int().optional(),
  vatOnUsed: z.boolean().optional(),
  delayHours: z.number().int().min(12).optional(),
  monetization: inSet(MONETIZATIONS).optional(),
  notes: optionalString,
});

export const invoiceCreateSchema = z.object({
  number: z.string().trim().min(1),
  basis: optionalString,
  service: optionalString,
  amount: z.number().optional(),
  vatRate: z.number().int().optional(),
  ourBankAccount: optionalString,
  appendixNo: optionalString,
});

// Создание сотрудника (страница «Команда», только Owner).
export const userCreateSchema = z.object({
  name: z.string().trim().min(1, "Укажите имя"),
  email: z.string().trim().toLowerCase().email("Некорректный e-mail"),
  password: z.string().min(6, "Пароль минимум 6 символов"),
  role: z.enum(["Manager", "Director"]).optional(),
});

// Правка сотрудника (переименование, смена роли; страница «Команда», только Owner).
export const userUpdateSchema = z.object({
  name: z.string().trim().min(1, "Укажите имя").optional(),
  role: z.enum(["Owner", "Manager", "Director"]).optional(),
});

// ── Бюджет отдела (кабинет руководителя) ─────────────────────────────────────
const ym = z.string().regex(/^\d{4}-\d{2}$/, "Формат месяца: ГГГГ-ММ");

export const deptBudgetSchema = z.object({
  month: ym,
  plannedBudget: z.number().nonnegative(),
});

export const deptIncomeSchema = z.object({
  month: ym,
  source: z.string().trim().min(1, "Укажите источник"),
  clientName: optionalString,
  w1: z.number().nonnegative().optional(),
  w2: z.number().nonnegative().optional(),
  w3: z.number().nonnegative().optional(),
  w4: z.number().nonnegative().optional(),
});
export const deptIncomeUpdateSchema = deptIncomeSchema.partial();

const optDate = z.string().optional().or(z.literal("").transform(() => undefined));
export const deptExpenseSchema = z.object({
  month: ym,
  department: optionalString,
  category: optionalString,
  accountingSub: optionalString,
  legalEntity: optionalString,
  title: z.string().trim().min(1, "Укажите наименование"),
  periodicity: optionalString,
  vatRate: z.number().int().optional(),
  amountTotal: z.number().nonnegative().optional(),
  spentTotal: z.number().nonnegative().optional(),
  payFormat: optionalString,
  payDate: optDate,
  deliveryDate: optDate,
  serviceEndDate: optDate,
  actClosedDate: optDate,
  justification: optionalString,
  description: optionalString,
  status: z.enum(["Не согласовано", "Согласовано", "Оплачено"]).optional(),
});
export const deptExpenseUpdateSchema = deptExpenseSchema.partial().omit({ month: true });

export const dailyStatusCreateSchema = z.object({
  advertiserId: z.string().min(1, "Выберите проект/рекламодателя"),
  dealId: optionalString,
  text: z.string().trim().min(1, "Пустой статус"),
});

export const plannedPaymentCreateSchema = z.object({
  advertiserId: z.string().min(1, "Выберите рекламодателя"),
  dealId: optionalString,
  periodMonth: z.string().regex(/^\d{4}-\d{2}$/, "Формат месяца: ГГГГ-ММ"),
  amount: z.number().nonnegative(),
  status: inSet(PLANNED_PAYMENT_STATUSES).optional(),
  note: optionalString,
});
export const plannedPaymentUpdateSchema = z.object({
  amount: z.number().nonnegative().optional(),
  status: inSet(PLANNED_PAYMENT_STATUSES).optional(),
  note: optionalString,
  // перенос карточки оплаты на другой месяц (стрелки ←/→ в календаре)
  periodMonth: z.string().regex(/^\d{4}-\d{2}$/, "Формат месяца: ГГГГ-ММ").optional(),
});

export const placementCreateSchema = z
  .object({
    advertiserId: optionalString,
    brandLabel: optionalString,
    dealId: optionalString,
    slot: z.string().trim().min(1, "Укажите слот/формат"),
    responsible: optionalString,
    startDate: z.string().min(1, "Дата начала"),
    endDate: z.string().min(1, "Дата конца"),
    status: inSet(PLACEMENT_STATUSES).optional(),
    notes: optionalString,
  })
  .refine((d) => d.advertiserId || d.brandLabel, {
    message: "Укажите рекламодателя или бренд",
    path: ["brandLabel"],
  });

export const placementUpdateSchema = z.object({
  slot: z.string().trim().min(1).optional(),
  responsible: optionalString,
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: inSet(PLACEMENT_STATUSES).optional(),
  notes: optionalString,
});

// ── Турнирный контур (кабинет Артёма) ────────────────────────────────────────
export const contractorCreateSchema = z.object({
  name: z.string().trim().min(1, "Укажите заказчика"),
  brand: optionalString,
  contactPerson: optionalString,
  contact: optionalString,
  status: inSet(TOURNAMENT_CONTRACTOR_STATUSES).optional(),
  notes: optionalString,
});
export const contractorUpdateSchema = contractorCreateSchema.partial();

export const tournamentCreateSchema = z.object({
  title: z.string().trim().min(1, "Укажите название турнира"),
  contractorId: optionalString,
  clientLabel: optionalString,
  discipline: optionalString,
  format: inSet(TOURNAMENT_FORMATS).optional(),
  arena: optionalString,
  startDate: optDate,
  endDate: optDate,
  status: inSet(TOURNAMENT_STATUSES).optional(),
  budgetNote: optionalString,
});
export const tournamentUpdateSchema = tournamentCreateSchema.partial();

export const budgetLineCreateSchema = z.object({
  category: z.string().trim().min(1, "Укажите статью"),
  title: optionalString,
  amountPlanned: z.number().nonnegative().optional(),
  amountActual: z.number().nonnegative().optional(),
  notes: optionalString,
  sort: z.number().int().optional(),
});
export const budgetLineUpdateSchema = budgetLineCreateSchema.partial();

export const arenaBookingCreateSchema = z
  .object({
    tournamentId: optionalString,
    contractorId: optionalString,
    clientLabel: optionalString,
    zone: optionalString,
    timeSlot: optionalString,
    startDate: z.string().min(1, "Дата начала"),
    endDate: z.string().min(1, "Дата конца"),
    status: inSet(ARENA_BOOKING_STATUSES).optional(),
    notes: optionalString,
  })
  .refine((d) => d.tournamentId || d.contractorId || d.clientLabel, {
    message: "Укажите турнир, заказчика или бренд",
    path: ["clientLabel"],
  });
export const arenaBookingUpdateSchema = z.object({
  tournamentId: optionalString,
  contractorId: optionalString,
  clientLabel: optionalString,
  zone: optionalString,
  timeSlot: optionalString,
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: inSet(ARENA_BOOKING_STATUSES).optional(),
  notes: optionalString,
});

// ── Внутренний мессенджер ────────────────────────────────────────────────────
export const channelCreateSchema = z.object({
  name: z.string().trim().min(1, "Название канала"),
  description: optionalString,
});
export const chatMessagePatchSchema = z.object({
  pinned: z.boolean().optional(),
  body: z.string().trim().min(1).optional(),
});

export const promoStandaloneCreateSchema = promoCreateSchema.extend({
  advertiserId: z.string().min(1, "Выберите рекламодателя"),
});

export const ordStandaloneCreateSchema = ordCreateSchema.extend({
  dealId: z.string().min(1, "Выберите сделку"),
});

export const closingCreateSchema = z.object({
  kind: inSet(CLOSING_KINDS),
  number: optionalString,
  appendixNo: optionalString,
  upDStatus: z.number().int().optional(),
  amount: z.number().optional(),
});

// ── Заявки с сайта ───────────────────────────────────────────────────────────
export const leadPatchSchema = z.object({
  status: inSet(LEAD_STATUSES).optional(),
  comment: optionalString,
  // null — снять ответственного, строка — назначить сотрудника
  assignedToId: z.string().min(1).nullable().optional(),
});

// ── Запросы на решение руководителю ──────────────────────────────────────────
export const DECISION_KINDS = ["Согласование", "Доступ", "Деньги", "Другое"] as const;
export const DECISION_STATUSES = ["Открыт", "Решён", "Отклонён"] as const;

export const decisionCreateSchema = z.object({
  title: z.string().trim().min(1, "Опишите, что нужно решить"),
  details: optionalString,
  kind: z.enum(DECISION_KINDS).optional(),
  advertiserId: optionalString,
  dealId: optionalString,
});

export const decisionPatchSchema = z.object({
  status: z.enum(DECISION_STATUSES).optional(),
  answer: optionalString,
});
