import { marked } from "marked";

// Рендер markdown → HTML для базы знаний. Контент внутренний (доверенный).
// GFM-таблицы включены; результат стилизуется классом .prose-kb.
marked.setOptions({ gfm: true, breaks: true });

export function renderMarkdown(md: string): string {
  return marked.parse(md, { async: false }) as string;
}
