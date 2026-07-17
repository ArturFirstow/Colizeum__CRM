import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { canSeeOwned } from "@/lib/scope";
import { PageHeader, Field, UrgencyBadge, EmptyState, WarningFlag } from "@/components/ui/primitives";
import { StageChanger } from "@/components/deals/StageChanger";
import { EditDealButton } from "@/components/deals/EditDealButton";
import { QuickAdd } from "@/components/deals/QuickAdd";
import { DecisionButton } from "@/components/deals/DecisionButton";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { formatMoney, formatDate, netOfVat } from "@/lib/format";
import { hasWarningFlag } from "@/lib/ui-tokens";
import {
  CLOSING_KINDS,
  CONTRACT_CONSTRUCTIONS,
  MONETIZATIONS,
  ORD_ROLES,
  PROMO_MECHANICS,
} from "@/lib/enums";

export const dynamic = "force-dynamic";

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deal = await prisma.deal.findUnique({
    where: { id },
    include: {
      advertiser: true,
      owner: true,
      assignee: true,
      mediaPlans: { include: { lines: true }, orderBy: { version: "desc" } },
      invoices: { include: { payments: true }, orderBy: { createdAt: "desc" } },
      closingDocs: { orderBy: { createdAt: "desc" } },
      ordMarkings: { orderBy: { createdAt: "desc" } },
      promoBatches: { orderBy: { createdAt: "desc" } },
      tasks: { orderBy: { createdAt: "desc" } },
      documents: { include: { versions: { orderBy: { versionNo: "desc" }, take: 1 } } },
    },
  });
  if (!deal) notFound();
  // Сделка чужого клиента не показывается (личные кабинеты).
  const session = await requireSession();
  if (!canSeeOwned(session, deal.advertiser.ownerId)) notFound();

  const construction = CONTRACT_CONSTRUCTIONS.find((c) => c.code === deal.contractConstruction);
  const ep = `/api/deals/${deal.id}`;

  return (
    <div>
      <Link href="/deals" className="mb-4 inline-flex text-sm text-ink-400 hover:text-brand">
        ← Сделки
      </Link>

      <PageHeader
        title={deal.title}
        subtitle={undefined}
        actions={
          <>
            <UrgencyBadge urgency={deal.urgency} />
            <EditDealButton deal={deal} />
            <DeleteButton
              endpoint={`/api/deals/${deal.id}`}
              what={`сделку «${deal.title}»`}
              redirectTo="/deals"
              variant="button"
            />
          </>
        }
      />
      <div className="-mt-4 mb-6">
        <Link href={`/advertisers/${deal.advertiserId}`} className="text-sm text-ink-300 hover:text-brand">
          {deal.advertiser.nameRu}
        </Link>
      </div>

      {/* Стадия */}
      <section className="card mb-6 p-5">
        <div className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-400">Стадия сделки</div>
        <StageChanger dealId={deal.id} current={deal.stage} />
      </section>

      {/* Callouts */}
      <div className="mb-6 grid gap-3 md:grid-cols-3">
        {deal.decisionPending && (
          <div className="card p-4 !border-brand/40 md:col-span-1">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand">◆ Ждёт решения</div>
            <p className="text-sm text-brand-100">{deal.decisionPending}</p>
            <div className="mt-3">
              <DecisionButton dealId={deal.id} />
            </div>
          </div>
        )}
        {deal.blocker && (
          <div className="card p-4 !border-red-500/30">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-300">⛔ Блокер</div>
            <p className="text-sm text-red-100">{deal.blocker}</p>
          </div>
        )}
        {/* Ситуативные блокеры — отдельное временное поле, в базу знаний не уходит (v2, п.1.3). */}
        {deal.situational && (
          <div className="card p-4 !border-orange-500/30">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-orange-300">
              ⚡ Ситуативные блокеры и срочные задачи
            </div>
            <p className="whitespace-pre-wrap text-sm text-orange-100">{deal.situational}</p>
          </div>
        )}
        {deal.nextStep && (
          <div className="card p-4">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">→ Следующий шаг</div>
            <p className="text-sm text-ink-100">
              {deal.nextStep}
              {deal.nextStepDate && (
                <span className="text-ink-400"> · до {formatDate(deal.nextStepDate)}</span>
              )}
            </p>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Основное */}
        <div className="space-y-6 lg:col-span-2">
          {/* Финансовая цепочка */}
          <Section
            title="Финансы"
            hint="Счёт → Платёж → УПД → Отчёт → Акт сверки"
            action={
              <QuickAdd
                label="+ Счёт"
                title="Новый счёт"
                endpoint={`${ep}/invoices`}
                fields={[
                  { name: "number", label: "Номер счёта", required: true, half: true },
                  { name: "appendixNo", label: "№ приложения", half: true },
                  { name: "basis", label: "Основание", placeholder: "Приложение №… к Договору" },
                  { name: "service", label: "Услуга" },
                  { name: "amount", label: "Сумма", type: "number", half: true },
                  { name: "vatRate", label: "НДС %", type: "number", default: "22", half: true },
                ]}
              />
            }
          >
            {deal.invoices.length === 0 ? (
              <EmptyState icon="₽" title="Счетов нет" />
            ) : (
              <div className="space-y-3">
                {deal.invoices.map((inv) => (
                  <div key={inv.id} className="rounded-xl border border-ink-800 bg-ink-900/50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-ink-100">Счёт {inv.number}</div>
                        <div className="mt-0.5 text-xs text-ink-400">
                          {inv.basis ?? inv.service ?? "—"}
                          {inv.appendixNo ? ` · прил. №${inv.appendixNo}` : ""}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-ink-100">{formatMoney(inv.amount)}</div>
                        {inv.ourBankAccount && (
                          <div className="text-xs text-ink-500">р/с …{inv.ourBankAccount.slice(-5)}</div>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 border-t border-ink-800 pt-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-medium uppercase tracking-wide text-ink-500">Платежи</span>
                        <QuickAdd
                          label="+ Платёж"
                          title="Платёжное поручение"
                          buttonClass="text-xs text-brand hover:underline"
                          endpoint={`/api/invoices/${inv.id}/payments`}
                          fields={[
                            { name: "number", label: "№ ПП", half: true },
                            { name: "amount", label: "Сумма", type: "number", half: true },
                            { name: "payer", label: "Плательщик" },
                            { name: "purpose", label: "Назначение" },
                          ]}
                        />
                      </div>
                      {inv.payments.length === 0 ? (
                        <p className="text-xs text-ink-500">Оплат нет.</p>
                      ) : (
                        inv.payments.map((p) => (
                          <div key={p.id} className="flex items-center justify-between py-1 text-sm">
                            <span className="text-ink-300">
                              ✓ ПП {p.number ?? "—"} · {formatDate(p.paidAt)}
                            </span>
                            <span className="text-emerald-300">{formatMoney(p.amount)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between border-t border-ink-800 pt-4">
              <span className="text-sm font-medium text-ink-300">Закрывающие</span>
              <QuickAdd
                label="+ Закрывающий"
                title="Закрывающий документ"
                endpoint={`${ep}/closing-docs`}
                fields={[
                  { name: "kind", label: "Тип", type: "select", options: CLOSING_KINDS, half: true },
                  { name: "number", label: "Номер", half: true },
                  { name: "appendixNo", label: "№ приложения", half: true },
                  { name: "upDStatus", label: "Статус УПД (1/2)", type: "number", half: true },
                  { name: "amount", label: "Сумма", type: "number" },
                ]}
              />
            </div>
            {deal.closingDocs.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {deal.closingDocs.map((c) => (
                  <span key={c.id} className="badge badge-muted">
                    {c.kind} {c.number ?? ""} {c.appendixNo ? `· прил.${c.appendixNo}` : ""}{" "}
                    {c.amount ? `· ${formatMoney(c.amount)}` : ""}
                  </span>
                ))}
              </div>
            )}
          </Section>

          {/* Медиапланы */}
          <Section
            title="Медиапланы"
            action={
              <QuickAdd
                label="+ МП"
                title="Медиаплан"
                endpoint={`${ep}/mediaplans`}
                fields={[
                  { name: "version", label: "Версия", type: "number", default: "1", half: true },
                  { name: "vatRate", label: "НДС %", type: "number", default: "22", half: true },
                  { name: "totalAmount", label: "Сумма итого", type: "number", half: true },
                  { name: "reachTotal", label: "Охват", type: "number", half: true },
                  { name: "notes", label: "Заметки", type: "textarea" },
                ]}
              />
            }
          >
            {deal.mediaPlans.length === 0 ? (
              <EmptyState icon="📊" title="Медиапланов нет" />
            ) : (
              <div className="space-y-3">
                {deal.mediaPlans.map((mp) => (
                  <div key={mp.id} className="rounded-xl border border-ink-800 bg-ink-900/50 p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-ink-100">Версия {mp.version}</span>
                      <span className="text-ink-100">
                        {formatMoney(mp.totalAmount)} {mp.vatRate ? `· НДС ${mp.vatRate}%` : ""}
                      </span>
                    </div>
                    {mp.lines.length > 0 && (
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full text-sm">
                          <tbody className="divide-y divide-ink-800">
                            {mp.lines.map((l) => (
                              <tr key={l.id}>
                                <td className="py-1.5 pr-3 text-ink-200">{l.formatName}</td>
                                <td className="py-1.5 pr-3 text-right text-ink-400">{l.qty ?? ""}</td>
                                <td className="py-1.5 text-right text-ink-200">{formatMoney(l.sum)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {mp.notes && <p className="mt-2 text-xs text-ink-400">{mp.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Документы */}
          <Section
            title="Документы"
            action={
              <Link href={`/documents?advertiser=${deal.advertiserId}`} className="btn btn-ghost btn-sm">
                Хранилище →
              </Link>
            }
          >
            {deal.documents.length === 0 ? (
              <EmptyState icon="❐" title="Документов нет" hint="Загрузите во вкладке «Документы»." />
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {deal.documents.map((d) => (
                  <div key={d.id} className="rounded-xl border border-ink-800 bg-ink-900/50 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className="badge badge-brand">{d.type}</span>
                      <span className="text-xs text-ink-500">v{d.versions[0]?.versionNo ?? 0}</span>
                    </div>
                    <div className="mt-1.5 truncate text-sm text-ink-100">{d.title}</div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* Правая колонка */}
        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="mb-4 text-lg font-bold text-ink-50">Карточка сделки</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Тип сделки">{deal.dealType}</Field>
                <Field label="Конечный бренд">{deal.finalBrand}</Field>
              </div>
              <Field label="Конструкция договора">
                {construction ? `${construction.code} — ${construction.label}` : "—"}
              </Field>
              <Field label="Сумма">
                {deal.amount != null ? (
                  <span>
                    {formatMoney(deal.amount)}{" "}
                    <span className="text-ink-400">{deal.vatIncluded ? "с НДС 22%" : "без НДС"}</span>
                    {/* Чистая стоимость считается автоматически: сумма с НДС / 1,22 */}
                    {deal.vatIncluded && (
                      <span className="block text-xs text-ink-400">
                        без НДС ≈ {formatMoney(netOfVat(deal.amount))}
                      </span>
                    )}
                  </span>
                ) : (
                  "—"
                )}
              </Field>
              {deal.contractTotal != null && (
                <Field label="Сумма по договору (весь период)">
                  <span>
                    {formatMoney(deal.contractTotal)} <span className="text-ink-400">с НДС 22%</span>
                    <span className="block text-xs text-ink-400">
                      без НДС ≈ {formatMoney(netOfVat(deal.contractTotal))}
                    </span>
                  </span>
                </Field>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Дата запуска">{deal.launchDate ? formatDate(deal.launchDate) : null}</Field>
                <Field label="Срок">{deal.periodText}</Field>
              </div>
              <Field label="Схема оплаты">{deal.paymentTerms}</Field>
              <Field label="Номер договора">{deal.contractNumber}</Field>
              <Field label="Юрист">{deal.legalResponsible}</Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Владелец">{deal.owner?.name}</Field>
                <Field label="Ответственный">{deal.assignee?.name}</Field>
              </div>
            </div>
            {hasWarningFlag(deal.notes) && (
              <div className="mt-4">
                <WarningFlag />
              </div>
            )}
            {deal.notes && <p className="mt-3 whitespace-pre-wrap text-sm text-ink-400">{deal.notes}</p>}
          </section>

          {/* ОРД */}
          <section className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-ink-50">ОРД / маркировка</h2>
              <QuickAdd
                label="+ ЕРИД"
                title="Маркировка ЕРИД"
                endpoint={`${ep}/ord`}
                fields={[
                  { name: "role", label: "Роль", type: "select", options: ORD_ROLES },
                  { name: "erid", label: "ЕРИД" },
                  { name: "finalClient", label: "Конечный заказчик" },
                  { name: "platform", label: "Площадка", placeholder: "соцсети / моб.приложение / пуши" },
                  { name: "monthlyClosing", label: "Ежемесячное закрытие актов", type: "checkbox", default: true },
                ]}
              />
            </div>
            {deal.ordMarkings.length === 0 ? (
              <p className="text-sm text-ink-400">Записей нет.</p>
            ) : (
              <div className="space-y-2">
                {deal.ordMarkings.map((o) => (
                  <div key={o.id} className="rounded-xl border border-ink-800 bg-ink-900/50 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="badge badge-muted">{o.role}</span>
                      {o.monthlyClosing && <span className="text-xs text-teal-300">акты ежемесячно</span>}
                    </div>
                    {o.erid && <div className="mt-1 font-mono text-xs text-ink-300">{o.erid}</div>}
                    {o.finalClient && <div className="text-xs text-ink-400">→ {o.finalClient}</div>}
                    <div className="mt-1 text-xs text-ink-500">
                      {o.platform ?? ""} {o.expiresAt ? `· до ${formatDate(o.expiresAt)}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Промокоды */}
          <section className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-ink-50">Промокоды</h2>
              <QuickAdd
                label="+ Партия"
                title="Партия промокодов"
                endpoint={`${ep}/promo`}
                fields={[
                  { name: "mechanic", label: "Механика", type: "select", options: PROMO_MECHANICS, half: true },
                  { name: "monetization", label: "Монетизация", type: "select", options: MONETIZATIONS, half: true },
                  { name: "nominal", label: "Номинал", type: "number", half: true },
                  { name: "qty", label: "Количество", type: "number", half: true },
                  { name: "delayHours", label: "Отсрочка (ч, ≥12)", type: "number", default: "12", half: true },
                  { name: "vatOnUsed", label: "+22% НДС на использованные", type: "checkbox", default: true },
                  { name: "notes", label: "Заметки", type: "textarea" },
                ]}
              />
            </div>
            {deal.promoBatches.length === 0 ? (
              <p className="text-sm text-ink-400">Партий нет.</p>
            ) : (
              <div className="space-y-2">
                {deal.promoBatches.map((p) => (
                  <div key={p.id} className="rounded-xl border border-ink-800 bg-ink-900/50 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="badge badge-muted">{p.mechanic}</span>
                      <span className="text-ink-300">
                        {p.qty ?? "?"} × {p.nominal ?? "?"}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-ink-500">
                      отсрочка {p.delayHours} ч · {p.monetization}
                      {p.vatOnUsed ? " · +22% на использованные" : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Задачи */}
          <section className="card p-5">
            <h2 className="mb-4 text-lg font-bold text-ink-50">Задачи</h2>
            {deal.tasks.length === 0 ? (
              <p className="text-sm text-ink-400">Задач нет.</p>
            ) : (
              <div className="space-y-2">
                {deal.tasks.map((t) => (
                  <div key={t.id} className="flex items-center justify-between rounded-lg bg-ink-900/50 px-3 py-2 text-sm">
                    <span className="truncate text-ink-200">{t.title}</span>
                    <span className="badge badge-muted shrink-0">{t.status}</span>
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

function Section({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink-50">{title}</h2>
          {hint && <p className="mt-0.5 text-xs text-ink-500">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
