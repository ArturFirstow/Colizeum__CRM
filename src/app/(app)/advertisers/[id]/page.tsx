import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader, TypeBadge, StageBadge, Field, EmptyState, WarningFlag } from "@/components/ui/primitives";
import { AddContactButton } from "@/components/advertisers/AddContactButton";
import { EditAdvertiserButton } from "@/components/advertisers/EditAdvertiserButton";
import { AgencyClients } from "@/components/advertisers/AgencyClients";
import { NewDealButton } from "@/components/deals/NewDealButton";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { formatMoney } from "@/lib/format";
import { hasWarningFlag } from "@/lib/ui-tokens";

export const dynamic = "force-dynamic";

export default async function AdvertiserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const advertiser = await prisma.advertiser.findUnique({
    where: { id },
    include: {
      contacts: { orderBy: { isPrimary: "desc" } },
      deals: { orderBy: { updatedAt: "desc" } },
      documents: { include: { versions: { orderBy: { versionNo: "desc" }, take: 1 } }, orderBy: { type: "asc" } },
      agencyClients: { orderBy: { createdAt: "asc" } },
    },
  });

  const isAgency = advertiser?.type === "Агентство";
  if (!advertiser) notFound();

  return (
    <div>
      <Link href="/advertisers" className="mb-4 inline-flex text-sm text-ink-400 hover:text-brand">
        ← Рекламодатели
      </Link>

      <PageHeader
        title={advertiser.nameRu}
        subtitle={advertiser.legalEntity ?? undefined}
        actions={
          <>
            <TypeBadge type={advertiser.type} />
            <EditAdvertiserButton advertiser={advertiser} />
            <NewDealButton presetAdvertiserId={advertiser.id} />
            <DeleteButton
              endpoint={`/api/advertisers/${advertiser.id}`}
              what={`контрагента «${advertiser.nameRu}» со всеми сделками и документами`}
              redirectTo="/advertisers"
              variant="button"
            />
          </>
        }
      />

      {hasWarningFlag(advertiser.notes) && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <span>⚠️</span>
          <span>{advertiser.notes}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Сделки */}
          <section className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-ink-50">Сделки</h2>
              <span className="badge badge-muted">{advertiser.deals.length}</span>
            </div>
            {advertiser.deals.length === 0 ? (
              <EmptyState icon="⑂" title="Сделок пока нет" />
            ) : (
              <div className="space-y-2">
                {advertiser.deals.map((d) => (
                  <Link
                    key={d.id}
                    href={`/deals/${d.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-ink-800 bg-ink-900/50 px-4 py-3 transition hover:border-ink-600 hover:bg-ink-800"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium text-ink-100">{d.title}</div>
                      {d.amount != null && (
                        <div className="mt-0.5 text-xs text-ink-400">
                          {formatMoney(d.amount)} {d.vatIncluded ? "с НДС" : "без НДС"}
                        </div>
                      )}
                    </div>
                    <StageBadge stage={d.stage} />
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Клиенты агентства (если контрагент = Агентство) */}
          {isAgency && (
            <AgencyClients advertiserId={advertiser.id} clients={advertiser.agencyClients} />
          )}

          {/* Документы */}
          <section className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-ink-50">Документы</h2>
              <Link href={`/documents?advertiser=${advertiser.id}`} className="text-sm text-brand hover:underline">
                Открыть в хранилище →
              </Link>
            </div>
            {advertiser.documents.length === 0 ? (
              <EmptyState icon="❐" title="Документов пока нет" hint="Загрузите первый документ во вкладке «Документы»." />
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {advertiser.documents.map((doc) => (
                  <div key={doc.id} className="rounded-xl border border-ink-800 bg-ink-900/50 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className="badge badge-brand">{doc.type}</span>
                      <span className="text-xs text-ink-500">v{doc.versions[0]?.versionNo ?? 0}</span>
                    </div>
                    <div className="mt-2 truncate text-sm font-medium text-ink-100">{doc.title}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Реквизиты + контакты */}
        <div className="space-y-6">
          <section className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-ink-50">Реквизиты</h2>
              <EditAdvertiserButton advertiser={advertiser} />
            </div>
            <div className="space-y-3">
              <Field label="Юрлицо">{advertiser.legalEntity}</Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="ИНН">{advertiser.inn}</Field>
                <Field label="КПП">{advertiser.kpp}</Field>
              </div>
              <Field label="ОГРН">{advertiser.ogrn}</Field>
              <Field label="Юр. адрес">{advertiser.address}</Field>
              {(advertiser.bankName || advertiser.bankAccount) && (
                <>
                  <Field label="Банк">{advertiser.bankName}</Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Р/с">{advertiser.bankAccount}</Field>
                    <Field label="БИК">{advertiser.bik}</Field>
                  </div>
                </>
              )}
              <Field label="Подписант">{advertiser.signatory}</Field>
              <Field label="Статус">{advertiser.status}</Field>
              {advertiser.goals && <Field label="Цели">{advertiser.goals}</Field>}
            </div>
          </section>

          <section className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-ink-50">Контакты</h2>
              <AddContactButton advertiserId={advertiser.id} />
            </div>
            {advertiser.contacts.length === 0 ? (
              <p className="text-sm text-ink-400">Контактов нет.</p>
            ) : (
              <div className="space-y-2">
                {advertiser.contacts.map((c) => (
                  <div key={c.id} className="rounded-xl border border-ink-800 bg-ink-900/50 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-ink-100">{c.fio}</span>
                      {c.isPrimary && <span className="badge badge-brand">основной</span>}
                    </div>
                    {c.role && <div className="text-xs text-ink-400">{c.role}</div>}
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-300">
                      {c.telegram && <span>{c.telegram}</span>}
                      {c.phone && <span>{c.phone}</span>}
                      {c.email && <span>{c.email}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
