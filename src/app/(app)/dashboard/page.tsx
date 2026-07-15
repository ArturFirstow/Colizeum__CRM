import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { PageHeader, StatCard, EmptyState, StageBadge, UrgencyBadge } from "@/components/ui/primitives";
import { DecisionButton } from "@/components/deals/DecisionButton";
import { DailyStatusPanel } from "@/components/dashboard/DailyStatusPanel";
import { formatMoney, formatDate, daysBetween } from "@/lib/format";
import { TASK_KIND_EMOJI } from "@/lib/ui-tokens";

const STUCK_DAYS = 7;

export default async function DashboardPage() {
  const session = await getSession();
  const now = new Date();

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [decisions, blockers, openTasks, stuckDeals, recentJournal, counts, advertisers, dealOpts, todayStatuses] = await Promise.all([
    prisma.deal.findMany({
      where: { decisionPending: { not: null } },
      include: { advertiser: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.deal.findMany({
      where: { blocker: { not: null } },
      include: { advertiser: true },
      orderBy: { urgency: "desc" },
    }),
    prisma.task.findMany({
      where: { status: { not: "Готова" } },
      include: { advertiser: true, assignee: true, deal: true },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 8,
    }),
    prisma.deal.findMany({
      where: {
        updatedAt: { lt: new Date(now.getTime() - STUCK_DAYS * 86400000) },
        stage: { not: "Закрывающие" },
      },
      include: { advertiser: true },
      orderBy: { updatedAt: "asc" },
      take: 6,
    }),
    prisma.journalEntry.findMany({ orderBy: { date: "desc" }, take: 4 }),
    Promise.all([
      prisma.deal.count(),
      prisma.advertiser.count(),
      prisma.document.count(),
      prisma.task.count({ where: { status: { not: "Готова" } } }),
    ]),
    prisma.advertiser.findMany({ select: { id: true, nameRu: true }, orderBy: { nameRu: "asc" } }),
    prisma.deal.findMany({ select: { id: true, title: true, advertiserId: true }, orderBy: { updatedAt: "desc" } }),
    prisma.dailyStatus.findMany({
      where: { date: { gte: todayStart } },
      include: { advertiser: { select: { nameRu: true } }, deal: { select: { title: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const [dealCount, advCount, docCount, activeTasks] = counts;
  const hour = now.getHours();
  const greeting = hour < 6 ? "Доброй ночи" : hour < 12 ? "Доброе утро" : hour < 18 ? "Добрый день" : "Добрый вечер";

  return (
    <div>
      <PageHeader
        title={`${greeting}, ${session?.name.split(" ")[0] ?? ""}`}
        subtitle={now.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        icon="◆"
      />

      {/* Метрики */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Активные сделки" value={dealCount} href="/deals" />
        <StatCard label="Рекламодатели" value={advCount} href="/advertisers" />
        <StatCard label="Задачи в работе" value={activeTasks} href="/tasks" accent={activeTasks > 0} />
        <StatCard label="Документы" value={docCount} href="/documents" />
      </div>

      {/* Статус дня по проектам + недельный отчёт */}
      <div className="mb-8">
        <DailyStatusPanel advertisers={advertisers} deals={dealOpts} today={todayStatuses} />
      </div>

      {/* Решения, которые ждут */}
      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-ink-50">
          <span className="text-brand">◆</span> Решения, которые ждут вас
        </h2>
        {decisions.length === 0 ? (
          <EmptyState icon="✅" title="Нет ожидающих решений" hint="Всё под контролем — можно выдохнуть." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {decisions.map((d) => (
              <div key={d.id} className="card card-hover p-4 !border-brand/30">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/deals/${d.id}`} className="block truncate font-semibold text-ink-50 hover:text-brand">
                      {d.title}
                    </Link>
                    <div className="mt-0.5 text-xs text-ink-400">{d.advertiser.nameRu}</div>
                  </div>
                  <UrgencyBadge urgency={d.urgency} />
                </div>
                <p className="mt-3 rounded-lg bg-ink-900/60 px-3 py-2 text-sm text-brand-100">
                  {d.decisionPending}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <StageBadge stage={d.stage} />
                  <DecisionButton dealId={d.id} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Задачи */}
        <section className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-ink-50">Ближайшие задачи</h2>
            <Link href="/tasks" className="text-sm text-brand hover:underline">
              Все задачи →
            </Link>
          </div>
          {openTasks.length === 0 ? (
            <EmptyState icon="🎯" title="Открытых задач нет" />
          ) : (
            <div className="card divide-y divide-ink-800">
              {openTasks.map((t) => {
                const overdue = t.dueDate && t.dueDate < now;
                return (
                  <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="text-lg">{TASK_KIND_EMOJI[t.kind] ?? "•"}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-ink-100">{t.title}</div>
                      <div className="mt-0.5 truncate text-xs text-ink-500">
                        {t.deal?.title ?? t.advertiser?.nameRu ?? "Без привязки"}
                        {t.assignee ? ` · ${t.assignee.name}` : ""}
                      </div>
                    </div>
                    {t.dueDate && (
                      <span className={`text-xs ${overdue ? "text-red-300" : "text-ink-400"}`}>
                        {overdue ? "просрочено · " : ""}
                        {formatDate(t.dueDate)}
                      </span>
                    )}
                    <span className="badge badge-muted">{t.status}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Блокеры + журнал */}
        <section className="space-y-6">
          <div>
            <h2 className="mb-3 text-lg font-bold text-ink-50">Активные блокеры</h2>
            {blockers.length === 0 ? (
              <EmptyState icon="🟢" title="Блокеров нет" />
            ) : (
              <div className="space-y-2">
                {blockers.slice(0, 5).map((d) => (
                  <Link
                    key={d.id}
                    href={`/deals/${d.id}`}
                    className="block rounded-xl border border-red-500/25 bg-red-500/[0.07] p-3 transition hover:bg-red-500/[0.12]"
                  >
                    <div className="text-sm font-semibold text-ink-100">{d.advertiser.nameRu}</div>
                    <div className="mt-0.5 text-xs text-red-200/90">{d.blocker}</div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-ink-50">Журнал</h2>
              <Link href="/journal" className="text-sm text-brand hover:underline">
                →
              </Link>
            </div>
            {recentJournal.length === 0 ? (
              <EmptyState icon="✎" title="Записей нет" />
            ) : (
              <div className="space-y-2">
                {recentJournal.map((j) => (
                  <div key={j.id} className="surface p-3">
                    <div className="mb-1 flex items-center gap-2 text-xs text-ink-500">
                      <span className="badge badge-muted">{j.source}</span>
                      {formatDate(j.date)}
                    </div>
                    <p className="line-clamp-2 text-xs text-ink-300">{j.parsedSummary ?? j.rawText}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Зависшие сделки */}
      {stuckDeals.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-bold text-ink-50">
            Зависли дольше {STUCK_DAYS} дней
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stuckDeals.map((d) => (
              <Link key={d.id} href={`/deals/${d.id}`} className="card card-hover p-4">
                <div className="flex items-center justify-between">
                  <div className="truncate font-semibold text-ink-100">{d.advertiser.nameRu}</div>
                  <span className="text-xs text-ink-500">{daysBetween(d.updatedAt, now)} дн.</span>
                </div>
                <div className="mt-1 truncate text-xs text-ink-400">{d.title}</div>
                <div className="mt-3 flex items-center justify-between">
                  <StageBadge stage={d.stage} />
                  {d.amount != null && <span className="text-xs text-ink-400">{formatMoney(d.amount)}</span>}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
