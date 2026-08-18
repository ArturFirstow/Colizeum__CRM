import { marked } from "marked";

// Рендер markdown → HTML для базы знаний. Контент внутренний (доверенный).
// GFM-таблицы включены; результат стилизуется классом .prose-kb.
marked.setOptions({ gfm: true, breaks: true });

export function renderMarkdown(md: string): string {
  return marked.parse(md, { async: false }) as string;
}

/**
 * Рендер длинных документов (правовые страницы). Отличие одно: перенос строки
 * в исходнике НЕ превращается в перенос на экране. Иначе абзац, аккуратно
 * разбитый в коде по 80 символов, рвался посреди предложения.
 */
export function renderDocument(md: string): string {
  return marked.parse(md, { async: false, breaks: false, gfm: true }) as string;
}
