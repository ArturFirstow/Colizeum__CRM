import "server-only";

// ─────────────────────────────────────────────────────────────────────────────
// Что можно загружать в сервис (требование 5.6: ограничение размера и типа).
//
// Раньше принимался любой файл любого размера — тип просто записывался со слов
// браузера. Так в хранилище мог попасть исполняемый файл или архив на гигабайт.
//
// Проверяем ДВА признака и оба обязаны совпасть с разрешёнными:
//   1) расширение в имени файла — его не подделать незаметно для человека;
//   2) тип, который назвал браузер.
// Браузер иногда не знает тип (присылает пустой или octet-stream) — тогда
// доверяем расширению: иначе люди не смогут загрузить обычный документ.
//
// Список намеренно узкий: это сервис для договоров, макетов и таблиц, а не
// файлообменник. Расширять — здесь, одной строкой.
// ─────────────────────────────────────────────────────────────────────────────

/** Предел на один файл. В nginx стоит 60 МБ — держим чуть ниже, чтобы отказ
 *  приходил понятным текстом от сервиса, а не обрывом соединения. */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

/** Разрешённые расширения → допустимые типы от браузера. */
const ALLOWED: Record<string, string[]> = {
  // Документы
  pdf: ["application/pdf"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  rtf: ["application/rtf", "text/rtf"],
  txt: ["text/plain"],
  md: ["text/markdown", "text/plain"],
  // Таблицы
  xls: ["application/vnd.ms-excel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  csv: ["text/csv", "application/csv", "text/plain"],
  // Презентации
  ppt: ["application/vnd.ms-powerpoint"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  // Картинки и макеты
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  png: ["image/png"],
  gif: ["image/gif"],
  webp: ["image/webp"],
  svg: ["image/svg+xml"],
  heic: ["image/heic"],
  // Записи встреч
  mp3: ["audio/mpeg", "audio/mp3"],
  m4a: ["audio/mp4", "audio/x-m4a"],
  wav: ["audio/wav", "audio/x-wav"],
  ogg: ["audio/ogg"],
  mp4: ["video/mp4"],
  // Архивы — приходят от юристов пакетом документов
  zip: ["application/zip", "application/x-zip-compressed"],
};

/** Типы, которые браузер ставит, когда сам не знает, что это за файл. */
const UNKNOWN_TYPES = new Set(["", "application/octet-stream", "binary/octet-stream"]);

export const ALLOWED_EXTENSIONS = Object.keys(ALLOWED);

export type UploadCheck = { ok: true } | { ok: false; message: string };

/** Проверяет файл перед сохранением. Сообщение написано для человека. */
export function checkUpload(fileName: string, contentType: string, sizeBytes: number): UploadCheck {
  if (sizeBytes > MAX_FILE_BYTES) {
    const mb = Math.round(MAX_FILE_BYTES / 1024 / 1024);
    const got = (sizeBytes / 1024 / 1024).toFixed(1);
    return { ok: false, message: `Файл слишком большой: ${got} МБ при пределе ${mb} МБ.` };
  }
  if (sizeBytes === 0) {
    return { ok: false, message: "Файл пустой — проверьте, что он загрузился полностью." };
  }

  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  const allowedTypes = ALLOWED[ext];
  if (!allowedTypes) {
    return {
      ok: false,
      message:
        `Такие файлы загружать нельзя (.${ext || "без расширения"}). ` +
        `Можно: документы, таблицы, презентации, картинки, записи встреч и zip-архивы.`,
    };
  }

  const type = (contentType || "").toLowerCase().split(";")[0].trim();
  if (UNKNOWN_TYPES.has(type)) return { ok: true }; // браузер не распознал — верим расширению
  if (!allowedTypes.includes(type)) {
    return {
      ok: false,
      message: `Содержимое файла не похоже на «.${ext}». Проверьте, что файл не повреждён и не переименован.`,
    };
  }
  return { ok: true };
}
