import { ExternalLink } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Ссылка на бизнес-процесс в Aspro.Cloud (просьба коллег И-5).
//
// Часть работы живёт в Aspro: там согласования и процессы, здесь — клиенты,
// сделки и документы. Пока сервисы не связаны между собой, людям хватает
// обычной ссылки: открыл карточку — и одним нажатием попал в тот же процесс
// в Aspro, не выискивая его поиском.
//
// Один компонент на все три места (клиент, сделка, маркировка), чтобы ссылка
// везде выглядела одинаково и узнавалась с первого взгляда.
// ─────────────────────────────────────────────────────────────────────────────

export function AsproLink({ url, compact = false }: { url: string | null; compact?: boolean }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      title="Открыть процесс в Aspro.Cloud"
      className={
        compact
          ? "inline-flex items-center gap-1 text-xs text-ink-400 transition hover:text-brand"
          : "inline-flex items-center gap-1.5 rounded-lg border border-ink-700 bg-ink-800/60 px-2.5 py-1 text-xs text-ink-300 transition hover:border-brand/40 hover:text-brand"
      }
    >
      <ExternalLink size={12} strokeWidth={2.2} />
      Aspro
    </a>
  );
}
