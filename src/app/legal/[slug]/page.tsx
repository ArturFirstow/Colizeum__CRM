import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LEGAL_DOCS, findLegalDoc } from "@/lib/legal";
import { renderDocument } from "@/lib/markdown";

// Правовые документы лежат ВНЕ группы (app): они должны открываться без входа,
// в том числе по ссылке из подвала страницы входа.

export const dynamic = "force-static";

export function generateStaticParams() {
  return LEGAL_DOCS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const doc = findLegalDoc(slug);
  return { title: doc ? `${doc.title} — Colizeum Agency` : "Документ не найден" };
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = findLegalDoc(slug);
  if (!doc) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:py-14">
      <Link href="/login" className="text-sm text-ink-400 hover:text-brand">
        ← Ко входу
      </Link>

      <h1 className="mt-5 font-display text-2xl font-semibold uppercase tracking-wide text-ink-50 sm:text-3xl">
        {doc.title}
      </h1>
      <p className="mt-2 text-sm text-ink-500">Служебный сервис Colizeum Agency</p>

      <article
        className="prose-kb mt-8"
        dangerouslySetInnerHTML={{ __html: renderDocument(doc.body) }}
      />

      {/* Соседние документы — чтобы не возвращаться на вход ради перехода */}
      <nav className="mt-12 border-t border-ink-800 pt-6">
        <div className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-500">
          Другие документы
        </div>
        <div className="flex flex-col gap-2">
          {LEGAL_DOCS.filter((d) => d.slug !== doc.slug).map((d) => (
            <Link
              key={d.slug}
              href={`/legal/${d.slug}`}
              className="text-sm text-ink-300 hover:text-brand"
            >
              {d.title}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
