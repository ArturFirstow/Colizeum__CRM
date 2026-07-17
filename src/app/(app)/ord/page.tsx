import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { NewOrdButton, OrdRowActions, EridInline, EditOrdButton } from "@/components/ord/OrdControls";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function OrdPage() {
  const [markings, deals] = await Promise.all([
    prisma.ordMarking.findMany({
      include: { deal: { include: { advertiser: { select: { nameRu: true } } } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.deal.findMany({
      include: { advertiser: { select: { nameRu: true } } },
      orderBy: { updatedAt: "desc" },
    }),
  ]);
  const dealOptions = deals.map((d) => ({ id: d.id, title: d.title, advertiserName: d.advertiser.nameRu }));

  return (
    <div>
      <PageHeader
        title="ОРД / маркировка"
        subtitle="Реестр ЕРИД. Акты закрываются каждый месяц, посты живут до 1 месяца."
        icon="❖"
        actions={<NewOrdButton deals={dealOptions} />}
      />

      {markings.length === 0 ? (
        <EmptyState icon="❖" title="Маркировок нет" hint="ЕРИД добавляются в карточке сделки." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-800 text-left text-xs uppercase tracking-wide text-ink-500">
                <th className="px-4 py-3 font-medium">Сделка</th>
                <th className="px-4 py-3 font-medium">Роль</th>
                <th className="px-4 py-3 font-medium">Конечный заказчик</th>
                <th className="px-4 py-3 font-medium">Площадка</th>
                <th className="px-4 py-3 font-medium">ЕРИД</th>
                <th className="px-4 py-3 font-medium">Живёт до</th>
                <th className="px-4 py-3 font-medium">Акты</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800">
              {markings.map((m) => (
                <tr key={m.id} className="hover:bg-ink-800/40">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link href={`/deals/${m.dealId}`} className="text-ink-100 hover:text-brand">
                        {m.deal.title}
                      </Link>
                      {m.urgent && (
                        <span className="badge bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-500/30">
                          🔴 срочно
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-ink-500">{m.deal.advertiser.nameRu}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="badge badge-muted">{m.role}</span>
                  </td>
                  <td className="px-4 py-3 text-ink-300">{m.finalClient ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-300">{m.platform ?? "—"}</td>
                  <td className="px-4 py-3">
                    <EridInline ord={m} />
                  </td>
                  <td className="px-4 py-3 text-ink-300">{m.expiresAt ? formatDate(m.expiresAt) : "—"}</td>
                  <td className="px-4 py-3">
                    {m.monthlyClosing ? (
                      <span className="text-xs text-teal-300">ежемесячно</span>
                    ) : (
                      <span className="text-xs text-ink-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <EditOrdButton ord={m} />
                      <OrdRowActions ord={m} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
