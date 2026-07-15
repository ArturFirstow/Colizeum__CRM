import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, EmptyState } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

export default async function PromoPage() {
  const batches = await prisma.promoBatch.findMany({
    include: { deal: { include: { advertiser: { select: { nameRu: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="Промокоды"
        subtitle="Партии по механикам. Отсрочка выдачи ≥ 12 ч, +22% НДС на использованные, учёт передачи через УПД."
        icon="%"
      />

      {batches.length === 0 ? (
        <EmptyState icon="%" title="Партий промокодов нет" hint="Партии добавляются в карточке сделки." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {batches.map((b) => (
            <div key={b.id} className="card p-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="badge badge-brand">{b.mechanic}</span>
                <span className="badge badge-muted">{b.monetization}</span>
              </div>
              <div className="text-2xl font-bold text-ink-50">
                {b.qty ?? "?"} <span className="text-base font-normal text-ink-400">× {b.nominal ?? "?"} ₽</span>
              </div>
              <Link href={`/deals/${b.dealId}`} className="mt-1 block text-sm text-ink-300 hover:text-brand">
                {b.deal.title}
              </Link>
              <div className="text-xs text-ink-500">{b.deal.advertiser.nameRu}</div>
              <div className="mt-3 flex flex-wrap gap-2 border-t border-ink-800 pt-3 text-xs text-ink-400">
                <span className="stat-chip">отсрочка {b.delayHours} ч</span>
                {b.vatOnUsed && <span className="stat-chip">+22% на использованные</span>}
              </div>
              {b.notes && <p className="mt-2 text-xs text-ink-500">{b.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
