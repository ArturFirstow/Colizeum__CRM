import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { isLeadership } from "@/lib/scope";
import { PageHeader } from "@/components/ui/primitives";
import { CountUp } from "@/components/ui/CountUp";
import { AssignTaskButton } from "@/components/leadership/AssignTaskButton";
import { formatMoney, formatDate, netOfVat } from "@/lib/format";
import { ROLE_LABELS, DEAL_STAGES, type Role } from "@/lib/enums";

export const dynamic = "force-dynamic";

export default async function LeadershipPage() {
  const session = await requireSession();
  if (!isLeadership(session)) redirect("/dashboard");

  // Все сотрудники + их данные (агрегируем по владельцу).
  const [users, advertisers, deals, tasks, payments, statuses] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.advertiser.findMany({ where: { archived: false }, select: { id: true, ownerId: true } }),
    prisma.deal.findMany({
      where: { advertiser: { archived: false } },
      select: { id: true, stage: true, amount: true, blocker: true, updatedAt: true, advertiser: { select: { ownerId: true } } },
    }),
    prisma.task.findMany({ where: { status: { not: "Готова" } }, select: { ownerId: true, dueDate: true } }),
    prisma.plannedPayment.findMany({ select: { amount: true, status: true, advertiser: { select: { ownerId: true } } } }),
    prisma.dailyStatus.findMany({ select: { advertiser: { select: { ownerId: true } }, date: true } }),
  ]);

  const now = new Date();
  const STUCK = new Date(now.getTime() - 7 * 86400000);

  // Метрика по каждому сотруднику.
  const byUser = users.map((u) => {
    const myAdv = advertisers.filter((a) => a.ownerId === u.id);
    const myDeals = deals.filter((d) => d.advertiser.ownerId === u.id && d.stage !== "Закрытие");
    const myTasks = tasks.filter((t) => t.ownerId === u.id);
    const myPay = payments.filter((p) => p.advertiser.ownerId === u.id);
    const lastStatus = statuses
      .filter((s) => s.advertiser.ownerId === u.id)
      .sort((a, b) => +new Date(b.date) - +new Date(a.date))[0];
    return {
      id: u.id,
      name: u.name,
      role: u.role as Role,
      clients: myAdv.length,
      deals: myDeals.length,
      portfolio: myDeals.reduce((s, d) => s + (d.amount ?? 0), 0),
      paid: myPay.filter((p) => p.status === "Оплачено").reduce((s, p) => s + p.amount, 0),
      due: myPay.filter((p) => p.status !== "Оплачено").reduce((s, p) => s + p.amount, 0),
      tasks: myTasks.length,
      overdue: myTasks.filter((t) => t.dueDate && new Date(t.dueDate) < now).length,
      blockers: myDeals.filter((d) => d.blocker).length,
      stuck: myDeals.filter((d) => new Date(d.updatedAt) < STUCK).length,
      lastActive: lastStatus?.date ?? null,
    };
  });

  // Только сотрудники-менеджеры (те, у кого есть клиенты или роль менеджера) для таблицы.
  const rows = byUser.filter((r) => r.role !== "Director" || r.clients > 0);

  const totals = {
    portfolio: rows.reduce((s, r) => s + r.portfolio, 0),
    paid: rows.reduce((s, r) => s + r.paid, 0),
    due: rows.reduce((s, r) => s + r.due, 0),
    clients: rows.reduce((s, r) => s + r.clients, 0),
    deals: rows.reduce((s, r) => s + r.deals, 0),
    blockers: rows.reduce((s, r) => s + r.blockers, 0),
    overdue: rows.reduce((s, r) => s + r.overdue, 0),
    stuck: rows.reduce((s, r) => s + r.stuck, 0),
  };

  // Воронка по стадиям (весь отдел).
  const funnel = DEAL_STAGES.map((stage) => ({
    stage,
    count: deals.filter((d) => d.stage === stage).length,
  }));
  const funnelMax = Math.max(1, ...funnel.map((f) => f.count));

  return (
    <div>
      <PageHeader
        title="Обзор отдела"
        subtitle="Сводная и по-сотрудная картина по всей команде коллабораций"
        icon="◎"
      />

      {/* Сводные метрики отдела */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4 lg:grid-rows-2">
        <div className="card !border-brand/30 p-6 lg:col-span-2 lg:row-span-2 lg:flex lg:flex-col lg:justify-center">
          <div className="text-xs uppercase tracking-wide text-ink-400">Портфель отдела</div>
          <div className="mt-3 font-display text-4xl font-semibold text-brand lg:text-5xl">
            <CountUp value={totals.portfolio} suffix=" ₽" duration={1100} />
          </div>
          <div className="mt-2 text-sm text-ink-400">
            без НДС ≈ {formatMoney(netOfVat(totals.portfolio))} · {totals.deals} активных сделок
          </div>
        </div>
        <Card label="Оплачено" value={totals.paid} money accent="text-emerald-300" />
        <Card label="Остаток к оплате" value={totals.due} money accent="text-amber-300" />
        <Card label="Клиентов" value={totals.clients} />
        <Card label="Задач в работе" value={totals.deals} sub={`${totals.overdue} просрочено`} />
      </div>

      {/* Требует внимания */}
      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <Alert label="Блокеров по отделу" value={totals.blockers} tone="red" />
        <Alert label="Просроченных задач" value={totals.overdue} tone="amber" />
        <Alert label="Зависших сделок (>7 дней)" value={totals.stuck} tone="amber" />
      </div>

      {/* Сотрудники — сравнение + провал внутрь */}
      <h2 className="mb-3 text-lg font-bold text-ink-50">Сотрудники</h2>
      <div className="mb-8 card overflow-x-auto">
        <table className="w-full min-w-[940px] text-sm">
          <thead>
            <tr className="border-b border-ink-800 text-left text-xs uppercase tracking-wide text-ink-500">
              <th className="px-4 py-3 font-medium">Сотрудник</th>
              <th className="px-4 py-3 font-medium">Клиентов</th>
              <th className="px-4 py-3 font-medium">Сделок</th>
              <th className="px-4 py-3 text-right font-medium">Портфель</th>
              <th className="px-4 py-3 text-right font-medium">Оплачено / остаток</th>
              <th className="px-4 py-3 font-medium">Задачи</th>
              <th className="px-4 py-3 font-medium">Блок.</th>
              <th className="px-4 py-3 font-medium">Завис.</th>
              <th className="px-4 py-3 font-medium">Активность</th>
              <th className="px-4 py-3 text-right font-medium">Поручить</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-800">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-ink-800/40">
                <td className="px-4 py-3">
                  <Link href={`/leadership/employee/${r.id}`} className="font-medium text-ink-100 hover:text-brand">
                    {r.name}
                  </Link>
                  <div className="text-xs text-ink-500">{ROLE_LABELS[r.role] ?? r.role}</div>
                </td>
                <td className="px-4 py-3 text-ink-200">{r.clients}</td>
                <td className="px-4 py-3 text-ink-200">{r.deals}</td>
                <td className="px-4 py-3 text-right font-mono text-ink-100">{formatMoney(r.portfolio)}</td>
                <td className="px-4 py-3 text-right font-mono text-xs">
                  <span className="text-emerald-300">{formatMoney(r.paid)}</span>
                  <span className="text-ink-500"> / {formatMoney(r.due)}</span>
                </td>
                <td className="px-4 py-3">
                  {r.tasks}
                  {r.overdue > 0 && <span className="text-red-300"> ({r.overdue})</span>}
                </td>
                <td className="px-4 py-3">{r.blockers > 0 ? <span className="text-red-300">{r.blockers}</span> : "—"}</td>
                <td className="px-4 py-3">{r.stuck > 0 ? <span className="text-amber-300">{r.stuck}</span> : "—"}</td>
                <td className="px-4 py-3 text-xs text-ink-400">{r.lastActive ? formatDate(r.lastActive) : "—"}</td>
                <td className="px-4 py-3 text-right">
                  {r.id !== session.userId && <AssignTaskButton employee={{ id: r.id, name: r.name }} variant="row" />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Воронка по стадиям */}
      <h2 className="mb-3 text-lg font-bold text-ink-50">Воронка отдела по стадиям</h2>
      <div className="card space-y-2 p-5">
        {funnel.map((f) => (
          <div key={f.stage} className="flex items-center gap-3">
            <div className="w-40 shrink-0 text-sm text-ink-300">{f.stage}</div>
            <div className="h-5 flex-1 overflow-hidden rounded bg-ink-800">
              <div
                className="h-full rounded bg-brand/70"
                style={{ width: `${(f.count / funnelMax) * 100}%` }}
              />
            </div>
            <div className="w-8 text-right text-sm tabular-nums text-ink-200">{f.count}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Card({ label, value, money, sub, accent }: { label: string; value: number; money?: boolean; sub?: string; accent?: string }) {
  return (
    <div className="card p-5">
      <div className="text-xs uppercase tracking-wide text-ink-400">{label}</div>
      <div className={`mt-2 font-display text-2xl font-semibold ${accent ?? "text-ink-50"}`}>
        {money ? <CountUp value={value} suffix=" ₽" /> : <CountUp value={value} />}
      </div>
      {sub && <div className="mt-0.5 text-xs text-ink-500">{sub}</div>}
    </div>
  );
}

function Alert({ label, value, tone }: { label: string; value: number; tone: "red" | "amber" }) {
  const c = tone === "red" ? "border-red-500/25 bg-red-500/[0.07] text-red-200" : "border-amber-500/25 bg-amber-500/[0.07] text-amber-100";
  return (
    <div className={`rounded-xl border px-4 py-3 ${c}`}>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs">{label}</div>
    </div>
  );
}
