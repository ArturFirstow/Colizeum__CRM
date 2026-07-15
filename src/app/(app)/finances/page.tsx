import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { formatMoney, formatDate } from "@/lib/format";
import { ORG } from "@/lib/org";

export const dynamic = "force-dynamic";

export default async function FinancesPage() {
  const deals = await prisma.deal.findMany({
    where: {
      OR: [
        { invoices: { some: {} } },
        { closingDocs: { some: {} } },
      ],
    },
    include: {
      advertiser: { select: { nameRu: true } },
      invoices: { include: { payments: true } },
      closingDocs: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  const totalInvoiced = deals.reduce(
    (s, d) => s + d.invoices.reduce((a, i) => a + (i.amount ?? 0), 0),
    0,
  );
  const totalPaid = deals.reduce(
    (s, d) => s + d.invoices.reduce((a, i) => a + i.payments.reduce((p, x) => p + (x.amount ?? 0), 0), 0),
    0,
  );

  return (
    <div>
      <PageHeader
        title="Финансы"
        subtitle="Счёт → Платёж → УПД → Отчёт → Акт сверки"
        icon="₽"
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <div className="text-xs uppercase tracking-wide text-ink-400">Выставлено</div>
          <div className="mt-2 text-2xl font-bold text-ink-50">{formatMoney(totalInvoiced)}</div>
        </div>
        <div className="card p-5">
          <div className="text-xs uppercase tracking-wide text-ink-400">Оплачено</div>
          <div className="mt-2 text-2xl font-bold text-emerald-300">{formatMoney(totalPaid)}</div>
        </div>
        <div className="card p-5">
          <div className="text-xs uppercase tracking-wide text-ink-400">Остаток</div>
          <div className="mt-2 text-2xl font-bold text-amber-300">{formatMoney(totalInvoiced - totalPaid)}</div>
        </div>
      </div>

      {/* Наши р/с — точка на выверку */}
      <div className="mb-6 rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-200">
          ⚠️ Наши расчётные счета — сверять под конкретный договор
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {ORG.accounts.map((acc) => (
            <div key={acc.value} className="rounded-xl border border-ink-800 bg-ink-900/50 px-4 py-3">
              <div className="text-sm font-semibold text-ink-100">{acc.label}</div>
              <div className="mt-0.5 font-mono text-xs text-ink-300">{acc.value}</div>
              <div className="text-xs text-ink-500">{acc.note}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 text-xs text-ink-500">
          {ORG.bank.name} · БИК {ORG.bank.bik} · к/с {ORG.bank.corr}
        </div>
      </div>

      {deals.length === 0 ? (
        <EmptyState icon="₽" title="Финансовых документов нет" hint="Счета и закрывающие создаются в карточке сделки." />
      ) : (
        <div className="space-y-4">
          {deals.map((d) => {
            const invoiced = d.invoices.reduce((a, i) => a + (i.amount ?? 0), 0);
            const paid = d.invoices.reduce(
              (a, i) => a + i.payments.reduce((p, x) => p + (x.amount ?? 0), 0),
              0,
            );
            return (
              <div key={d.id} className="card p-5">
                <div className="mb-3 flex items-center justify-between">
                  <Link href={`/deals/${d.id}`} className="font-semibold text-ink-100 hover:text-brand">
                    {d.title}
                    <span className="ml-2 text-xs text-ink-500">{d.advertiser.nameRu}</span>
                  </Link>
                  <div className="text-sm text-ink-300">
                    {formatMoney(paid)} / {formatMoney(invoiced)}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-500">Счета и оплаты</div>
                    {d.invoices.length === 0 ? (
                      <p className="text-xs text-ink-500">—</p>
                    ) : (
                      <div className="space-y-1.5">
                        {d.invoices.map((inv) => {
                          const invPaid = inv.payments.reduce((a, x) => a + (x.amount ?? 0), 0);
                          const done = invPaid >= (inv.amount ?? 0) && (inv.amount ?? 0) > 0;
                          return (
                            <div key={inv.id} className="flex items-center justify-between rounded-lg bg-ink-900/50 px-3 py-1.5 text-sm">
                              <span className="text-ink-300">
                                {done ? "✅" : "🕒"} Счёт {inv.number}
                                {inv.appendixNo ? ` · прил.${inv.appendixNo}` : ""}
                              </span>
                              <span className="text-ink-200">{formatMoney(inv.amount)}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-500">Закрывающие</div>
                    {d.closingDocs.length === 0 ? (
                      <p className="text-xs text-ink-500">—</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {d.closingDocs.map((c) => (
                          <span key={c.id} className="badge badge-muted">
                            {c.kind} {c.number ?? ""}
                            {c.appendixNo ? ` · прил.${c.appendixNo}` : ""}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
