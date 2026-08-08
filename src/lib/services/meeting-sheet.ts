// ─────────────────────────────────────────────────────────────────────────────
// Выгрузка встречи из «Дневника» строкой в Google-таблицу отчётности.
//
// Как это устроено. Google не даёт писать в таблицу анонимно, поэтому на стороне
// таблицы живёт маленький скрипт-приёмник (deploy/google-apps-script.gs,
// инструкция — docs/MEETINGS_SHEET.md). Мы шлём ему JSON вида
// { "Дата встречи": "08.08.2026", ... }, а он сам находит нужные колонки ПО ИХ
// НАЗВАНИЯМ в шапке листа и дописывает строку. Поэтому порядок и состав колонок
// в таблице можно менять — код править не придётся.
// ─────────────────────────────────────────────────────────────────────────────

import "server-only";

export type MeetingRow = {
  meetingDate: Date | null;
  startTime: string | null;
  endTime: string | null;
  durationHours: number | null;
  participants: string | null;
  meetingWith: string | null;
  protocolUrl: string | null;
  meetingUrl: string | null;
  clientName: string | null;
  employeeName: string | null;
  summary: string | null;
};

/** Настроена ли выгрузка (иначе интерфейс предложит скопировать строку руками). */
export function meetingSheetConfigured(): boolean {
  return Boolean(process.env.MEETINGS_SHEET_WEBHOOK_URL);
}

function ddmmyyyy(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/**
 * Продолжительность в часах с шагом 0,5 — как просит таблица учёта
 * (0,5 / 1,0 / 1,5 …). Встреча короче 15 минут всё равно считается за 0,5.
 */
export function durationFromTimes(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  let minutes = toMin(end) - toMin(start);
  if (minutes < 0) minutes += 24 * 60; // встреча перевалила за полночь
  if (minutes <= 0) return null;
  return Math.max(0.5, Math.round(minutes / 30) / 2);
}

/** Строка для таблицы: ключи — это названия колонок в шапке листа. */
export function buildSheetRow(m: MeetingRow): Record<string, string> {
  const hours = m.durationHours ?? durationFromTimes(m.startTime, m.endTime);
  return {
    "Дата встречи": m.meetingDate ? ddmmyyyy(m.meetingDate) : "",
    "Время начала": m.startTime ?? "",
    "Время окончания": m.endTime ?? "",
    // В таблицах учёта дробная часть пишется через запятую.
    Продолжительность: hours != null ? hours.toFixed(1).replace(".", ",") : "",
    Участники: m.participants ?? m.meetingWith ?? "",
    "С кем встреча": m.meetingWith ?? "",
    Клиент: m.clientName ?? "",
    Сотрудник: m.employeeName ?? "",
    "Ссылка на протокол": m.protocolUrl ?? "",
    "Ссылка на встречу": m.meetingUrl ?? "",
    Комментарий: m.summary ?? "",
  };
}

/** Та же строка одним куском — для кнопки «Скопировать строку для таблицы». */
export function rowAsTsv(m: MeetingRow): string {
  return Object.values(buildSheetRow(m)).join("\t");
}

/**
 * Отправляет строку в таблицу. Ошибку не бросает: запись в дневнике важнее
 * выгрузки, поэтому неуспех сохраняем текстом и показываем кнопку «Отправить ещё раз».
 */
export async function pushMeetingToSheet(
  m: MeetingRow,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const url = process.env.MEETINGS_SHEET_WEBHOOK_URL;
  if (!url) return { ok: false, error: "Выгрузка в таблицу не настроена (MEETINGS_SHEET_WEBHOOK_URL)" };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: process.env.MEETINGS_SHEET_TOKEN ?? "",
        sheet: process.env.MEETINGS_SHEET_TAB ?? "",
        row: buildSheetRow(m),
      }),
      // Apps Script отвечает редиректом на googleusercontent — идём за ним.
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
    const text = (await res.text()).slice(0, 300);
    if (!res.ok) return { ok: false, error: `Таблица ответила ${res.status}: ${text}` };
    // Скрипт отвечает {"ok":true} — на всякий случай терпим и пустой ответ.
    if (text && !text.includes('"ok":true') && !text.includes("ok=true")) {
      return { ok: false, error: `Таблица ответила: ${text}` };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Не удалось достучаться до таблицы: ${msg}` };
  }
}
