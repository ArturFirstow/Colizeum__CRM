// ─────────────────────────────────────────────────────────────────────────────
// Разбор ссылки на Google-таблицу.
//
// Сотрудник вставляет ссылку так, как её видит в браузере — со всем хвостом:
//   https://docs.google.com/spreadsheets/d/1AbC…XyZ/edit?gid=989964510#gid=989964510
// Нам из неё нужны две вещи: id самой таблицы и gid конкретного ЛИСТА (вкладки
// внизу). Без gid попадём на первый лист, а учёт у человека может вестись на
// третьем — поэтому gid вытаскиваем и из «?gid=», и из «#gid=».
//
// Ключи Google API не нужны: читаем CSV-экспортом, для этого у таблицы должен
// стоять доступ «Все, у кого есть ссылка» → «Читатель».
// ─────────────────────────────────────────────────────────────────────────────

export type SheetRef = {
  /** id таблицы (длинная строка между /d/ и /edit) */
  id: string;
  /** id листа-вкладки; «0» — первый лист */
  gid: string;
};

/**
 * Достаёт id таблицы и gid листа из ссылки.
 * Возвращает null, если это не ссылка на Google-таблицу.
 */
export function parseSheetUrl(raw: string | null | undefined): SheetRef | null {
  if (!raw) return null;
  const text = raw.trim();
  if (!text) return null;

  const id = text.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1];
  if (!id) return null;

  // gid ищем и в query (?gid=…), и в якоре (#gid=…) — Google пишет его по-разному.
  const gid = text.match(/[?&#]gid=(\d+)/)?.[1] ?? "0";
  return { id, gid };
}

/** Ссылка на CSV-экспорт конкретного листа — то, что читает сервис. */
export function sheetCsvUrl(ref: SheetRef): string {
  return `https://docs.google.com/spreadsheets/d/${ref.id}/export?format=csv&gid=${ref.gid}`;
}

/** Обычная ссылка «открыть таблицу в браузере» — для кнопок в интерфейсе. */
export function sheetHumanUrl(ref: SheetRef): string {
  return `https://docs.google.com/spreadsheets/d/${ref.id}/edit?gid=${ref.gid}`;
}

/**
 * Проверка ссылки для формы: понятное сообщение вместо молчаливого отказа.
 * Пустая строка — это «убрать таблицу», она допустима.
 */
export function validateSheetUrl(raw: string): string | null {
  if (!raw.trim()) return null;
  return parseSheetUrl(raw)
    ? null
    : "Это не похоже на ссылку на Google-таблицу. Скопируйте адрес из строки браузера — он начинается с https://docs.google.com/spreadsheets/d/…";
}
