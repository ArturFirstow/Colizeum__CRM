import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { canSeeOwned } from "@/lib/scope";
import { PageHeader, TypeBadge, StageBadge, UrgencyBadge, Field, EmptyState } from "@/components/ui/primitives";
import { AddContactButton } from "@/components/advertisers/AddContactButton";
import { EditAdvertiserButton } from "@/components/advertisers/EditAdvertiserButton";
import { AgencyClients } from "@/components/advertisers/AgencyClients";
import { ArchiveButton } from "@/components/advertisers/ArchiveButton";
import { Creatives } from "@/components/advertisers/Creatives";
import { NewDealButton } from "@/components/deals/NewDealButton";
import { AiSummaryButton } from "@/components/ai/AiButtons";
import { formatMoney } from "@/lib/format";

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
      creatives: { orderBy: { createdAt: "desc" } },
    },
  });

  const isAgency = advertiser?.type === "Агентство";
  if (!advertiser) notFound();
  // Чужого клиента не показываем (личные кабинеты).
  const session = await requireSession();
  if (!canSeeOwned(session, advertiser.ownerId)) notFound();

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
            {advertiser.archived && <span className="badge badge-muted">🗄 В архиве</span>}
            <TypeBadge type={advertiser.type} />
            <AiSummaryButton advertiserId={advertiser.id} />
            <EditAdvertiserButton advertiser={advertiser} />
            <NewDealButton presetAdvertiserId={advertiser.id} />
            {/* «Удаление» карточки = перемещение в Архив (v2, п.1.2), данные не теряются. */}
            <ArchiveButton advertiserId={advertiser.id} archived={advertiser.archived} />
          </>
        }
      />

      {/* Фиксированный порядок блоков (v2, п.1.3): Информация и контекст → Документы → Креативы */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* 1. Информация и контекст */}
          <section className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-ink-50">Информация и контекст</h2>
              <span className="badge badge-muted">{advertiser.deals.length} сделок</span>
            </div>
            {advertiser.goals && (
              <p className="mb-3 text-sm text-ink-300">{advertiser.goals}</p>
            )}
            {advertiser.deals.length === 0 ? (
              <EmptyState icon="⑂" title="Сделок пока нет" />
            ) : (
              <div className="space-y-2">
                {advertiser.deals.map((d) => (
                  <Link
                    key={d.id}
                    href={`/deals/${d.id}`}
                    className="block rounded-xl border border-ink-800 bg-ink-900/50 px-4 py-3 transition hover:border-ink-600 hover:bg-ink-800"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-ink-100">{d.title}</div>
                        <div className="mt-0.5 text-xs text-ink-400">
                          {d.finalBrand ? `бренд: ${d.finalBrand} · ` : ""}
                          {d.dealType ? `${d.dealType} · ` : ""}
                          {d.amount != null ? `${formatMoney(d.amount)} ${d.vatIncluded ? "с НДС" : "без НДС"}` : ""}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <UrgencyBadge urgency={d.urgency} />
                        <StageBadge stage={d.stage} />
                      </div>
                    </div>
                    {/* Ситуативные блокеры и срочные задачи — отдельное поле, в базу знаний не уходит (v2, п.1.3). */}
                    {d.situational && (
                      <div className="mt-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-200">
                        ⚡ {d.situational}
                      </div>
                    )}
                    {d.nextStep && (
                      <div className="mt-1.5 text-xs text-ink-400">→ {d.nextStep}</div>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Клиенты агентства (если контрагент = Агентство) */}
          {isAgency && (
            <AgencyClients advertiserId={advertiser.id} clients={advertiser.agencyClients} />
          )}

          {/* 2. Документы */}
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

          {/* 3. Креативы */}
          <Creatives advertiserId={advertiser.id} creatives={advertiser.creatives} />
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
