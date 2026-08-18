import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { ownScope } from "@/lib/scope";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { PaymentCalendar } from "@/components/finances/PaymentCalendar";
import { QuickAdd } from "@/components/deals/QuickAdd";
import { formatMoney, formatDate, netOfVat } from "@/lib/format";
import { sumMoney, toGross } from "@/components/ui/Money";
import { BUDGET_HINT, BUDGET_LABEL, budgetRows, isActiveForBudget } from "@/lib/budget";
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
  // Считаем по каждой сделке со своей пометкой про НДС — у записей, заведённых
  // до правила «вводим чистую», сумма лежит уже с НДС, и общий множитель
  // раздувал их второй раз.
  const activeDeals = deals.filter(isActiveForBudget);
  const budget = sumMoney(budgetRows(deals));
  // Плановые платежи — это РАЗБИВКА бюджета по месяцам, а не деньги сверх него.
  // Показываем их отдельной строкой внутри карточки бюджета, чтобы числа
  // не читались как два разных бюджета и нигде не складывались между собой.
  // Плановые платежи всегда заводятся чистыми — своей пометки у них нет.
  const scheduledNet = plannedPayments.reduce((s, p) => s + p.amount, 0);
  const scheduledGross = toGross(scheduledNet);
  const notScheduledGross = Math.max(0, budget.gross - scheduledGross);

  // Задвоенные платежи. Частая ошибка при заполнении: по клиенту заводят и
  // помесячные части, и ещё одну строку на всю сумму договора. Тогда календарь
  // честно складывает всё подряд, и «Итого» выглядит завышенным. Сравниваем по
  // каждому клиенту разложенное с суммой его договоров и показываем расхождение.
  const byClient = advertisers
    .map((a) => {
      const contract = sumMoney(
        budgetRows(deals.filter((d) => d.advertiser.id === a.id)),
      ).gross;
      const scheduled = toGross(
        plannedPayments.filter((p) => p.advertiserId === a.id).reduce((s, p) => s + p.amount, 0),
      );
      return { id: a.id, name: a.nameRu, contract, scheduled, gap: scheduled - contract };
    })
    .filter((r) => r.contract > 0 || r.scheduled > 0)
    .sort((a, b) => b.contract - a.contract);

  // Порог в 1 ₽ — копеечные округления при делении на месяцы не считаем ошибкой.
  const overscheduled = byClient.filter((r) => r.contract > 0 && r.gap > 1);

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
          <div className="text-xs uppercase tracking-wide text-ink-400">{BUDGET_LABEL}</div>
          <div className="mt-2 font-display text-2xl font-bold text-brand">{formatMoney(budget.gross)}</div>
          <div className="mt-0.5 text-xs text-ink-500">без НДС ≈ {formatMoney(budget.net)}</div>
          <div className="mt-2 border-t border-ink-800 pt-2 text-xs text-ink-500">{BUDGET_HINT}</div>
        </div>
        <SummaryCard label="Выставлено" value={totalInvoiced} color="text-ink-50" />
        <SummaryCard label="Оплачено" value={totalPaid} color="text-emerald-300" />
        <SummaryCard label="Остаток" value={totalInvoiced - totalPaid} color="text-amber-300" />
      </div>

      {/* Расшифровка: из чего складывается бюджет и почему календарь ниже
          показывает другую цифру. Одна таблица снимает почти все вопросы
          «а почему тут одно число, а там другое». */}
      {byClient.length > 0 && (
        <div className="card mb-6 overflow-x-auto p-0">
          <div className="px-5 pt-5">
            <h2 className="text-lg font-bold text-ink-50">Из чего складывается бюджет</h2>
            <p className="mt-0.5 text-xs text-ink-500">
              Все суммы с НДС. «Разложено» — то же, что «Итого» в календаре ниже.
            </p>
          </div>
          <table className="mt-3 w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-ink-800 text-xs uppercase tracking-wide text-ink-500">
                <th className="px-5 py-2.5 text-left font-medium">Клиент</th>
                <th className="px-3 py-2.5 text-right font-medium">Бюджет</th>
                <th className="px-3 py-2.5 text-right font-medium">Разложено по месяцам</th>
                <th className="px-5 py-2.5 text-right font-medium">Осталось разложить</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800/70">
              {byClient.map((r) => (
                <tr key={r.id}>
                  <td className="px-5 py-2.5 font-medium text-ink-100">{r.name}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink-200">
                    {formatMoney(r.contract)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink-300">
                    {formatMoney(r.scheduled)}
                  </td>
                  <td className="px-5 py-2.5 text-right tabular-nums">
                    {r.gap > 1 ? (
                      <span className="text-amber-300">лишнее {formatMoney(r.gap)}</span>
                    ) : -r.gap > 1 ? (
                      <span className="text-ink-400">{formatMoney(-r.gap)}</span>
                    ) : (
                      <span className="text-emerald-300">сходится</span>
                    )}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-ink-700 font-semibold">
                <td className="px-5 py-3 text-ink-100">Итого</td>
                <td className="px-3 py-3 text-right tabular-nums text-brand">{formatMoney(budget.gross)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-ink-200">{formatMoney(scheduledGross)}</td>
                <td className="px-5 py-3 text-right tabular-nums text-ink-400">
                  {notScheduledGross > 1 ? formatMoney(notScheduledGross) : "сходится"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Разложено больше, чем сумма договоров — почти всегда задвоенный платёж */}
      {overscheduled.length > 0 && (
        <div className="card mb-6 p-5 !border-amber-500/40">
          <div className="text-sm font-semibold text-amber-200">
            Проверьте платежи: разложено больше, чем сумма договоров
          </div>
          <p className="mt-1 text-xs text-ink-400">
            Обычно так бывает, когда по клиенту завели и помесячные части, и ещё одну строку на всю
            сумму договора. Лишнюю строку нужно удалить — тогда «Итого» в календаре сойдётся.
          </p>
          <div className="mt-3 space-y-1.5">
            {overscheduled.map((r) => (
              <div key={r.id} className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg bg-ink-900/50 px-3 py-2 text-sm">
                <span className="font-medium text-ink-100">{r.name}</span>
                <span className="text-xs text-ink-400">
                  бюджет {formatMoney(r.contract)} · разложено {formatMoney(r.scheduled)} ·{" "}
                  <span className="font-semibold text-amber-300">лишнее {formatMoney(r.gap)}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Помесячный календарь платежей */}
      <div className="mb-6">
        <PaymentCalendar
          advertisers={advertisers}
          payments={plannedPayments}
          budgets={Object.fromEntries(byClient.map((r) => [r.id, r.contract]))}
        />
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
