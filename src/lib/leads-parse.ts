// Разбор выгрузки Google-формы в заявки (чистые функции, без БД и сети —
// поэтому их можно гонять отдельно, см. parseLeadsCsv).

import { parseCsv } from "@/lib/csv";

// Заголовки формы → поля карточки. Ключ — «схлопнутое» имя колонки.
const FIELD_BY_HEADER: Record<string, keyof RawLead> = {
  name: "name",
  имя: "name",
  namecompany: "company",
  company: "company",
  компания: "company",
  contact: "contact",
  контакт: "contact",
  phone: "contact",
  email: "contact",
  textarea: "message",
  message: "message",
  сообщение: "message",
  комментарий: "message",
  referer: "referer",
  formid: "formId",
  sent: "sentAt",
  дата: "sentAt",
  requestid: "externalId",
};

export type RawLead = {
  externalId: string;
  name: string;
  company: string;
  contact: string;
  message: string;
  referer: string;
  formId: string;
  sentAt: string;
};

function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .replace(/[\s_\-.]/g, "")
    .trim();
}

/** Дата вида «2026-02-17 01:04:32» (и близкие) → Date. */
export function parseSentAt(value: string): Date | null {
  const v = value.trim();
  if (!v) return null;
  const iso = v.replace(" ", "T");
  const d = new Date(iso);
  if (!Number.isNaN(d.getTime())) return d;
  // запасной вариант: 17.02.2026 01:04
  const m = v.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:[ ,]+(\d{2}):(\d{2}))?/);
  if (m) {
    return new Date(
      Number(m[3]),
      Number(m[2]) - 1,
      Number(m[1]),
      Number(m[4] ?? 0),
      Number(m[5] ?? 0),
    );
  }
  return null;
}

/**
 * Разбирает CSV таблицы формы. Шапка ищется по строке со знакомыми колонками:
 * таблица начинается не с первой строки и содержит пустые колонки.
 */
export function parseLeadsCsv(csv: string): RawLead[] {
  const rows = parseCsv(csv);

  let headerIdx = -1;
  let map: Record<number, keyof RawLead> = {};
  for (let i = 0; i < rows.length; i++) {
    const candidate: Record<number, keyof RawLead> = {};
    rows[i].forEach((cell, col) => {
      const field = FIELD_BY_HEADER[normalizeHeader(cell)];
      if (field && !Object.values(candidate).includes(field)) candidate[col] = field;
    });
    // шапка — строка, где нашлись хотя бы контакт/имя и идентификатор заявки
    const found = Object.values(candidate);
    if (found.includes("externalId") || (found.includes("name") && found.includes("contact"))) {
      headerIdx = i;
      map = candidate;
      break;
    }
  }
  if (headerIdx === -1) return [];

  const out: RawLead[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const lead: RawLead = {
      externalId: "",
      name: "",
      company: "",
      contact: "",
      message: "",
      referer: "",
      formId: "",
      sentAt: "",
    };
    let filled = false;
    for (const [col, field] of Object.entries(map)) {
      const value = (row[Number(col)] ?? "").trim();
      if (value) {
        lead[field] = value;
        filled = true;
      }
    }
    if (!filled) continue;
    // без requestid ключ собираем сами, чтобы не задваивать при повторных импортах
    if (!lead.externalId) {
      lead.externalId = `manual:${lead.sentAt}|${lead.contact}|${lead.name}`.slice(0, 180);
    }
    out.push(lead);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Заявка, пришедшая от сайта НАПРЯМУЮ (вебхук Тильды), без Google-таблицы.
//
// Разбор тот же, что у таблицы: Тильда присылает поля формы под их
// собственными именами (name, name_company, contact, Textarea) — то есть ровно
// те, что потом становились колонками таблицы. Поэтому карта `FIELD_BY_HEADER`
// одна на оба пути: поправили имя поля на сайте — поправили в одном месте.
//
// Служебные поля Тильды: `tranid` — уникальный номер отправки (наш ключ от
// дублей), `formid` / `formname` — какая форма сработала, `COOKIES` — её
// технические куки, они нам не нужны. Поля с галочками согласий приходят как
// обычные поля формы и попадают в «прочее» (см. ниже).
// ─────────────────────────────────────────────────────────────────────────────

/** Поля Тильды, которые в карточку заявки не кладём. */
const SERVICE_KEYS = new Set([
  "cookies",
  "test",
  "tranid",
  "formid",
  "formname",
  "formservices",
  "projectid",
  "pageid",
  "pageurl",
  "ma",
]);

/**
 * Имя поля → человеку: «Я согласен (-а) с политикой» и прочее из формы.
 * Дефисы не трогаем: в названиях полей на сайте они часть текста («(-а)»).
 */
function prettyKey(key: string): string {
  return key.replace(/_+/g, " ").trim();
}

export type WebhookLead = RawLead & {
  /** Было ли это проверочное обращение Тильды при подключении вебхука. */
  isTest: boolean;
};

/**
 * Превращает тело запроса от Тильды в заявку.
 * Тело приходит и формой, и JSON — к этому моменту оно уже разобрано в объект.
 */
export function parseWebhookLead(
  payload: Record<string, unknown>,
  opts: { fallbackReferer?: string } = {},
): WebhookLead {
  const lead: WebhookLead = {
    externalId: "",
    name: "",
    company: "",
    contact: "",
    message: "",
    referer: "",
    formId: "",
    sentAt: "",
    isTest: false,
  };

  const extras: string[] = [];
  const contacts: string[] = [];

  for (const [rawKey, rawValue] of Object.entries(payload)) {
    const key = normalizeHeader(rawKey);
    const value = typeof rawValue === "string" ? rawValue.trim() : stringify(rawValue);
    if (key === "test") {
      lead.isTest = true;
      continue;
    }
    if (!value) continue;

    if (key === "tranid") {
      lead.externalId = `tilda:${value}`;
      continue;
    }
    if (key === "formid" || key === "formname") {
      lead.formId = lead.formId || value;
      continue;
    }
    if (key === "pageurl" || key === "referer") {
      lead.referer = lead.referer || value;
      continue;
    }
    if (SERVICE_KEYS.has(key)) continue;

    const field = FIELD_BY_HEADER[key];
    if (field === "contact" || key === "phone" || key === "email" || key === "tel") {
      // Контактов может быть несколько полей (телефон И почта) — собираем все,
      // иначе второй молча потерялся бы.
      contacts.push(value);
      continue;
    }
    if (field && field !== "externalId" && field !== "sentAt") {
      if (!lead[field]) lead[field] = value;
      continue;
    }
    // Всё остальное, что человек заполнил на сайте (согласия, доп. вопросы),
    // дописываем в текст обращения: терять то, что написал человек, нельзя.
    extras.push(`${prettyKey(rawKey)}: ${value}`);
  }

  if (contacts.length) lead.contact = [...new Set(contacts)].join(", ");
  if (extras.length) lead.message = [lead.message, ...extras].filter(Boolean).join("\n");
  if (!lead.referer && opts.fallbackReferer) lead.referer = opts.fallbackReferer;

  return lead;
}

/** Значения бывают числами, массивами (несколько галочек) и объектами. */
function stringify(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map((v) => stringify(v)).filter(Boolean).join(", ");
  if (typeof value === "object") {
    try {
      return Object.entries(value as Record<string, unknown>)
        .map(([k, v]) => `${k}: ${stringify(v)}`)
        .filter(Boolean)
        .join("; ");
    } catch {
      return "";
    }
  }
  return String(value).trim();
}
