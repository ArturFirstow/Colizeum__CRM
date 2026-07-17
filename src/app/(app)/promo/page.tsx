import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { ownScope } from "@/lib/scope";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { NewPromoButton } from "@/components/promo/NewPromoButton";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PromoPage() {
  // Личный кабинет: партии промокодов только своих клиентов.
  const session = await requireSession();
  const [batches, advertisers] = await Promise.all([
    prisma.promoBatch.findMany({
      where: {
        OR: [{ advertiser: ownScope(session) }, { deal: { advertiser: ownScope(session) } }],
      },
      include: {
        advertiser: { select: { id: true, nameRu: true } },
        deal: { include: { advertiser: { select: { id: true, nameRu: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.advertiser.findMany({ where: ownScope(session), select: { id: true, nameRu: true }, orderBy: { nameRu: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader
        title="Промокоды"
        subtitle="Карточки по рекламодателям: номиналы, количество, сроки, условия, взаиморасчёт."
        icon="%"
        actions={<NewPromoButton advertisers={advertisers} />}
      />

      {batches.length === 0 ? (
        <EmptyState icon="%" title="Партий промокодов нет" hint="Партии добавляются в карточке сделки." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {batches.map((b) => {
            const adv = b.advertiser ?? b.deal?.advertiser ?? null;
            return (
              <div key={b.id} className="card p-5">
                <div className="mb-3 flex items-center justify-between">
                  <span className="badge badge-brand">{b.mechanic}</span>
                  <div className="flex items-center gap-2">
                    <span className="badge badge-muted">{b.monetization}</span>
                    <DeleteButton endpoint={`/api/promo/${b.id}`} what="партию промокодов" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-ink-50">
                  {b.qty ?? "?"} <span className="text-base font-normal text-ink-400">× {b.nominal ?? "?"} ₽</span>
                </div>
                {adv && (
                  <Link href={`/advertisers/${adv.id}`} className="mt-1 block text-sm text-ink-300 hover:text-brand">
                    {adv.nameRu}
                  </Link>
                )}
                {(b.validFrom || b.validTo) && (
                  <div className="mt-1 text-xs text-ink-500">
                    Срок: {formatDate(b.validFrom)} — {formatDate(b.validTo)}
                  </div>
                )}
                {b.commercialTerms && <p className="mt-2 text-xs text-ink-400">{b.commercialTerms}</p>}
                {b.settlement && <p className="mt-1 text-xs text-ink-500">Взаиморасчёт: {b.settlement}</p>}
                <div className="mt-3 flex flex-wrap gap-2 border-t border-ink-800 pt-3 text-xs text-ink-400">
                  <span className="stat-chip">отсрочка {b.delayHours} ч</span>
                  {b.vatOnUsed && <span className="stat-chip">+22% на использованные</span>}
                </div>
                {b.notes && <p className="mt-2 text-xs text-ink-500">{b.notes}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
