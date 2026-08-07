import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { ownScope } from "@/lib/scope";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { PaymentCalendar } from "@/components/finances/PaymentCalendar";
import { QuickAdd } from "@/components/deals/QuickAdd";
import { formatMoney, formatDate, netOfVat } from "@/lib/format";
import { ORG } from "@/lib/org";
import { CLOSING_KINDS } from "@/lib/enums";

export const dynamic = "force-dynamic";

export default async function FinancesPage() {
  // Личный кабинет: финансы только по своим клиентам.
  const session = await requireSession();
  const myClients = { archived: false, ...ownScope(session) };
  const [deals, advertisers, plannedPayments] = await Promise.all([
    prisma.deal.findMany({
      where: { advertiser: myClients },
      include: {
        advertiser: { select: { id: true, nameRu: true } },
        invoices: { include: { payments: true }, orderBy: { createdAt: "desc" } },
        closingDocs: { orderBy: { createdAt: "desc" } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.advertiser.findMany({
      where: myClients,
      select: { id: true, nameRu: true },
      orderBy: { nameRu: "asc" },
    }),
    prisma.plannedPayment.findMany({ where: { advertiser: ownScope(session) }, orderBy: { periodMonth: "asc" } }),
  ]);

  const totalInvoiced = deals.reduce(
    (s, d) => s + d.invoices.reduce((a, i) => a + (i.amount ?? 0), 0),
    0,
  );
  const totalPaid = deals.reduce(
    (s, d) => s + d.invoices.reduce((a, i) => a + i.payments.reduce((p, x) => p + (x.amount ?? 0), 0), 0),
    0,
  );
  // Общий бюджет по всем клиентам: суммы по договорам активных сделок (ТЗ р.2, п.7).
  const totalBudget = deals
    .filter((d) => d.stage !== "Закрытие")
    .reduce((s, d) => s + (d.contractTotal ?? d.amount ?? 0), 0);

  return (
    <div>
      <PageHeader
        title="Оплаты"
        subtitle="Счёт → Платёж → УПД → Отчёт → Акт сверки"
        icon="₽"
      />

      {/* Сводный бюджет + суммы парой: с НДС 22 % и чистая без НДС */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card !border-brand/30 p-5">
          <div className="text-xs uppercase tracking-wide text-ink-400">Общий бюджет по клиентам</div>
          <div className="mt-2 font-display text-2xl font-bold text-brand">{formatMoney(totalBudget)}</div>
          <div className="mt-0.5 text-xs text-ink-500">без НДС ≈ {formatMoney(netOfVat(totalBudget))}</div>
        </div>
        <SummaryCard label="Выставлено" value={totalInvoiced} color="text-ink-50" />
        <SummaryCard label="Оплачено" value={totalPaid} color="text-emerald-300" />
        <SummaryCard label="Остаток" value={totalInvoiced - totalPaid} color="text-amber-300" />
      </div>

      {/* Помесячный календарь платежей */}
      <div className="mb-6">
        <PaymentCalendar advertisers={advertisers} payments={plannedPayments} />
      </div>

      {/* Корзины клиентов: счета, платёжные поручения, УПД */}
      <h2 className="mb-3 text-lg font-bold text-ink-50">Корзины клиентов</h2>
      {deals.length === 0 ? (
        <EmptyState icon="₽" title="Активных сделок нет" />
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
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/deals/${d.id}`} className="font-semibold text-ink-100 hover:text-brand">
                    {d.advertiser.nameRu}
                    <span className="ml-2 text-xs text-ink-500">{d.title}</span>
                  </Link>
                  <div className="flex items-center gap-2">
                    <div className="mr-2 text-right">
                      <div className="text-sm text-ink-300">
                        {formatMoney(paid)} / {formatMoney(invoiced)}
                      </div>
                      {invoiced > 0 && (
                        <div className="text-xs text-ink-500">без НДС ≈ {formatMoney(netOfVat(invoiced))}</div>
                      )}
                    </div>
                    <QuickAdd
                      label="+ Счёт"
                      title={`Новый счёт — ${d.advertiser.nameRu}`}
                      endpoint={`/api/deals/${d.id}/invoices`}
                      fields={[
                        { name: "number", label: "Номер счёта", required: true, half: true },
                        { name: "appendixNo", label: "№ приложения", half: true },
                        { name: "basis", label: "Основание", placeholder: "Приложение №… к Договору" },
                        { name: "amount", label: "Сумма с НДС", type: "number", half: true },
                        { name: "vatRate", label: "НДС %", type: "number", default: "22", half: true },
                      ]}
                    />
                    <QuickAdd
                      label="+ УПД"
                      title={`Закрывающий документ — ${d.advertiser.nameRu}`}
                      endpoint={`/api/deals/${d.id}/closing-docs`}
                      fields={[
                        { name: "kind", label: "Тип", type: "select", options: CLOSING_KINDS, half: true },
                        { name: "number", label: "Номер", half: true },
                        { name: "appendixNo", label: "№ приложения", half: true },
                        { name: "amount", label: "Сумма", type: "number", half: true },
                      ]}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-500">
                      Счета и платёжные поручения
                    </div>
                    {d.invoices.length === 0 ? (
                      <p className="text-xs text-ink-500">Счетов нет — добавьте «+ Счёт».</p>
                    ) : (
                      <div className="space-y-1.5">
                        {d.invoices.map((inv) => {
                          const invPaid = inv.payments.reduce((a, x) => a + (x.amount ?? 0), 0);
                          const done = invPaid >= (inv.amount ?? 0) && (inv.amount ?? 0) > 0;
                          return (
                            <div key={inv.id} className="rounded-lg bg-ink-900/50 px-3 py-2 text-sm">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-ink-300">
                                  {done ? "✅" : "🕒"} Счёт {inv.number}
                                  {inv.appendixNo ? ` · прил.${inv.appendixNo}` : ""}
                                </span>
                                <span className="flex items-center gap-2">
                                  <span className="text-ink-200">{formatMoney(inv.amount)}</span>
                                  <QuickAdd
                                    label="+ ПП"
                                    title={`Платёжное поручение к счёту ${inv.number}`}
                                    buttonClass="text-xs text-brand hover:underline"
                                    endpoint={`/api/invoices/${inv.id}/payments`}
                                    fields={[
                                      { name: "number", label: "№ ПП", half: true },
                                      { name: "amount", label: "Сумма", type: "number", half: true },
                                      { name: "payer", label: "Плательщик" },
                                      { name: "purpose", label: "Назначение" },
                                    ]}
                                  />
                                </span>
                              </div>
                              {inv.payments.length > 0 && (
                                <div className="mt-1 space-y-0.5">
                                  {inv.payments.map((p) => (
                                    <div key={p.id} className="flex items-center justify-between text-xs">
                                      <span className="text-ink-500">
                                        ✓ ПП {p.number ?? "—"} · {formatDate(p.paidAt)}
                                      </span>
                                      <span className="text-emerald-300">{formatMoney(p.amount)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-500">
                      УПД и закрывающие
                    </div>
                    {d.closingDocs.length === 0 ? (
                      <p className="text-xs text-ink-500">Пока нет — добавьте «+ УПД».</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {d.closingDocs.map((c) => (
                          <span key={c.id} className="badge badge-muted">
                            {c.kind} {c.number ?? ""}
                            {c.appendixNo ? ` · прил.${c.appendixNo}` : ""}
                            {c.amount ? ` · ${formatMoney(c.amount)}` : ""}
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

      {/* Наш расчётный счёт — справочно, в самом низу раздела (ТЗ р.2, п.7) */}
      <div className="mt-8 card p-5">
        <div className="mb-3 text-sm font-semibold text-ink-300">Наш расчётный счёт (справочно)</div>
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
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="card p-5">
      <div className="text-xs uppercase tracking-wide text-ink-400">{label}</div>
      <div className={`mt-2 text-2xl font-bold ${color}`}>{formatMoney(value)}</div>
      <div className="mt-0.5 text-xs text-ink-500">без НДС ≈ {formatMoney(netOfVat(value))}</div>
    </div>
  );
}
