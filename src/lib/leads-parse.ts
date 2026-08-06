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
