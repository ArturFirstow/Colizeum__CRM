import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { canSeeOwned } from "@/lib/scope";
import { PageHeader, TypeBadge, StageBadge, UrgencyBadge, Field, EmptyState } from "@/components/ui/primitives";
import { FileCell } from "@/components/ui/FileCell";
import { AddContactButton } from "@/components/advertisers/AddContactButton";
import { EditAdvertiserButton } from "@/components/advertisers/EditAdvertiserButton";
import { AsproLink } from "@/components/ui/AsproLink";
import { AgencyClients } from "@/components/advertisers/AgencyClients";
import { ArchiveButton } from "@/components/advertisers/ArchiveButton";
import { Creatives } from "@/components/advertisers/Creatives";
import { ClientTimeline } from "@/components/advertisers/ClientTimeline";
import { buildClientTimeline } from "@/lib/services/client-timeline";
import { writeAudit } from "@/lib/audit";
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

  // Открытие карточки клиента — действие с персональными данными: внутри
  // контакты, телефоны, почты. По требованию 5.3 это попадает в журнал.
  writeAudit({
    action: "advertiser.view",
    userId: session.userId,
    userName: session.name,
    entityType: "advertiser",
    entityId: advertiser.id,
  });

  // Единая лента событий по клиенту — собирается из всех разделов сразу.
  const timeline = await buildClientTimeline(advertiser.id);

  // ── Задачи по этому клиенту (пункт коллег И-1) ─────────────────────────────
  //
  // Раньше карточка показывала сделки, документы, креативы и хронологию — а
  // задач среди них не было. Приходилось держать в голове или идти на доску и
  // искать глазами. Здесь показываем только НЕЗАКРЫТЫЕ: закрытые уже не
  // требуют действий, а карточка нужна для «что сейчас по клиенту».
  const openTasks = await prisma.task.findMany({
    where: { advertiserId: advertiser.id, status: { not: "Готова" } },
    include: { assignee: { select: { name: true } } },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
  });
  const doneTasksCount = await prisma.task.count({
    where: { advertiserId: advertiser.id, status: "Готова" },
  });
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // ── Файлы клиента, приложенные где угодно ──────────────────────────────────
  //
  // Раньше в блоке «Документы» показывались только документы с версиями
  // (договор, спецификация), а файлы, приложенные из сделки или из «Документов»
  // — счета, медиапланы, макеты, — не показывались вовсе. Человек грузил файл,
  // потом открывал карточку и видел «Документов пока нет».
  //
  // Теперь оба вида рядом: слева документы, которые правят по версиям, справа
  // просто приложенные файлы — с указанием, откуда именно их принесли.
  const attachedFiles = await prisma.fileAsset.findMany({
    where: { advertiserId: advertiser.id },
    orderBy: { uploadedAt: "desc" },
    select: {
      id: true,
      title: true,
      fileName: true,
      kind: true,
      sizeBytes: true,
      ownerType: true,
      dealId: true,
      uploadedByName: true,
      uploadedAt: true,
    },
  });
  const dealTitles = new Map(advertiser.deals.map((d) => [d.id, d.title] as const));
  /** Откуда файл принесли — чтобы было понятно, где его искать дальше. */
  const fileSource = (f: (typeof attachedFiles)[number]): string => {
    if (f.dealId) return `из сделки «${dealTitles.get(f.dealId) ?? "—"}»`;
    if (f.ownerType === "knowledge") return "из базы знаний";
    if (f.ownerType === "journal") return "из дневника";
    if (f.ownerType === "inbox") return "из входящих";
    return "из карточки клиента";
  };

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
            {/* Ссылка на процесс в Aspro — рядом с кнопками карточки (И-5). */}
            <AsproLink url={advertiser.asproUrl} />
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
          {/* 1. Сделки.
              Раньше блок назывался «Информация и контекст», и сделки в нём
              терялись: человек искал их глазами и не находил, хотя они были
              прямо тут (пункт коллег И-2). Теперь заголовок называет то, что
              внутри, а цель сотрудничества стоит отдельной подписью сверху. */}
          <section className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-ink-50">Сделки</h2>
              <span className="badge badge-muted">{advertiser.deals.length}</span>
            </div>
            {advertiser.goals && (
              <p className="mb-4 rounded-xl border border-ink-800 bg-ink-900/40 px-4 py-2.5 text-sm text-ink-300">
                <span className="mr-2 text-xs uppercase tracking-wide text-ink-500">Цель сотрудничества</span>
                {advertiser.goals}
              </p>
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

          {/* 1.5. Задачи по клиенту (пункт коллег И-1) */}
          <section className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-ink-50">Задачи</h2>
              <span className="flex items-center gap-2">
                {doneTasksCount > 0 && (
                  <span className="text-xs text-ink-500">выполнено: {doneTasksCount}</span>
                )}
                <Link href="/tasks" className="text-sm text-brand hover:underline">
                  На доску →
                </Link>
              </span>
            </div>
            {openTasks.length === 0 ? (
              <EmptyState
                icon="✓"
                title="Открытых задач нет"
                hint={doneTasksCount > 0 ? "Всё, что было, уже закрыто." : "Задачи по клиенту заводятся на доске задач."}
              />
            ) : (
              <div className="space-y-1.5">
                {openTasks.map((t) => {
                  const overdue = t.dueDate ? new Date(t.dueDate) < today : false;
                  return (
                    <div
                      key={t.id}
                      className={`flex min-w-0 items-center gap-3 rounded-xl border px-4 py-2.5 ${
                        overdue ? "border-red-500/30 bg-red-500/5" : "border-ink-800 bg-ink-900/50"
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-ink-100">{t.title}</span>
                        <span className="block truncate text-xs text-ink-500">
                          {t.kind}
                          {t.assignee ? ` · ${t.assignee.name}` : ""}
                          {t.assignedById ? " · 🎯 поручение" : ""}
                        </span>
                      </span>
                      {t.dueDate && (
                        <span className={`shrink-0 text-xs ${overdue ? "text-red-300" : "text-ink-400"}`}>
                          {overdue ? "просрочено " : "до "}
                          {new Date(t.dueDate).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })}
                        </span>
                      )}
                      <span className="badge badge-muted shrink-0">{t.status}</span>
                    </div>
                  );
                })}
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
            {advertiser.documents.length === 0 && attachedFiles.length === 0 ? (
              <EmptyState icon="❐" title="Документов пока нет" hint="Загрузите первый документ во вкладке «Документы»." />
            ) : (
              <div className="space-y-4">
                {advertiser.documents.length > 0 && (
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

                {attachedFiles.length > 0 && (
                  <div>
                    <div className="mb-2 text-xs uppercase tracking-wide text-ink-500">
                      Прикреплённые файлы — {attachedFiles.length}
                    </div>
                    <div className="space-y-1.5">
                      {attachedFiles.map((f) => (
                        <a
                          key={f.id}
                          href={`/api/files/${f.id}`}
                          className="flex min-w-0 items-center gap-3 rounded-xl border border-ink-800 bg-ink-900/50 px-4 py-2.5 transition hover:border-ink-600"
                        >
                          <span className="shrink-0 text-ink-500">❏</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-ink-100">
                              {f.title || f.fileName}
                            </span>
                            <span className="block truncate text-xs text-ink-500">
                              {f.kind} · {fileSource(f)}
                              {f.uploadedByName ? ` · ${f.uploadedByName}` : ""}
                            </span>
                          </span>
                          <span className="shrink-0 text-xs text-ink-500">
                            {Math.max(1, Math.round(f.sizeBytes / 1024))} КБ
                          </span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* 3. Креативы */}
          <Creatives advertiserId={advertiser.id} creatives={advertiser.creatives} />

          {/* 4. Хронология: всё, что было с клиентом, одной лентой */}
          <ClientTimeline advertiserId={advertiser.id} events={timeline} />
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
              {/* Карточка контрагента файлом: реквизиты часто присылают одним PDF */}
              <div className="pt-1">
                <FileCell
                  ownerType="advertiser"
                  ownerId={advertiser.id}
                  kind="Документ"
                  advertiserId={advertiser.id}
                  label="Прикрепить карточку контрагента"
                  compact
                />
              </div>
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
