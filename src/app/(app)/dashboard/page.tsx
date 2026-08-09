import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatCard, EmptyState, StageBadge, UrgencyBadge } from "@/components/ui/primitives";
import { DecisionButton } from "@/components/deals/DecisionButton";
import { DailyStatusPanel } from "@/components/dashboard/DailyStatusPanel";
import { AskLeaderButton, DecisionRequestCard, MyDecisionRequests, type DecisionItem } from "@/components/dashboard/DecisionRequests";
import { formatMoney, formatDate, daysBetween } from "@/lib/format";
import { TASK_KIND_EMOJI } from "@/lib/ui-tokens";
import { requireSession } from "@/lib/auth";
import { ownScope, isLeadership } from "@/lib/scope";
import { netOfVat } from "@/lib/format";
import { CountUp } from "@/components/ui/CountUp";
import { StageRing } from "@/components/ui/StageRing";

const STUCK_DAYS = 7;

export default async function DashboardPage() {
  const session = await requireSession();
  const now = new Date();

  // Личный кабинет: дашборд считает только своих клиентов; архив скрыт.
  const notArchived = { advertiser: { archived: false, ...ownScope(session) } };
  const myTask = ownScope(session);

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const leader = isLeadership(session);

  // Запросы на решение: руководителю — все открытые от сотрудников,
  // сотруднику — его собственные (чтобы видел статус и ответ).
  const decisionRequests = await prisma.decisionRequest.findMany({
    where: leader ? { status: "Открыт" } : { requesterId: session.userId },
    include: {
      requester: { select: { id: true, name: true } },
      advertiser: { select: { id: true, nameRu: true } },
      deal: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const decisionItems: DecisionItem[] = decisionRequests.map((r) => ({
    id: r.id,
    title: r.title,
    details: r.details,
    kind: r.kind,
    status: r.status,
    answer: r.answer,
    createdAt: r.createdAt.toISOString(),
    attachmentsKey: r.attachmentsKey,
    requester: r.requester,
    advertiser: r.advertiser,
    deal: r.deal,
  }));
  const openRequests = decisionItems.filter((r) => r.status === "Открыт");
  // Фото руководителя на кнопке вопроса — чтобы было понятно, к кому идёт запрос.
  const leader_ = await prisma.user.findFirst({
    where: { role: "Director" },
    select: { name: true, avatarUrl: true },
  });

  const [decisions, blockers, openTasks, stuckDeals, recentJournal, counts, advertisers, dealOpts, todayStatuses] = await Promise.all([
    prisma.deal.findMany({
      where: { decisionPending: { not: null }, ...notArchived },
      include: { advertiser: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.deal.findMany({
      where: { blockerActive: true, ...notArchived },
      include: { advertiser: true },
      orderBy: { urgency: "desc" },
    }),
    prisma.task.findMany({
      where: { status: { not: "Готова" }, ...myTask },
      include: { advertiser: true, assignee: true, deal: true, assignedBy: { select: { name: true } } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 8,
    }),
    prisma.deal.findMany({
      where: {
        updatedAt: { lt: new Date(now.getTime() - STUCK_DAYS * 86400000) },
        stage: { not: "Закрытие" },
        ...notArchived,
      },
      include: { advertiser: true },
      orderBy: { updatedAt: "asc" },
      take: 6,
    }),
    prisma.journalEntry.findMany({ where: myTask, orderBy: { date: "desc" }, take: 4 }),
    Promise.all([
      prisma.deal.count({ where: notArchived }),
      prisma.advertiser.count({ where: { archived: false, ...ownScope(session) } }),
      prisma.document.count({ where: { advertiser: ownScope(session) } }),
      prisma.task.count({ where: { status: { not: "Готова" }, ...myTask } }),
    ]),
    prisma.advertiser.findMany({ where: { archived: false, ...ownScope(session) }, select: { id: true, nameRu: true }, orderBy: { nameRu: "asc" } }),
    prisma.deal.findMany({
      where: notArchived,
      select: { id: true, title: true, advertiserId: true, stage: true, amount: true, advertiser: { select: { nameRu: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.dailyStatus.findMany({
      where: { date: { gte: todayStart }, advertiser: ownScope(session) },
      include: { advertiser: { select: { nameRu: true } }, deal: { select: { title: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const [dealCount, advCount, docCount, activeTasks] = counts;
  const hour = now.getHours();
  const greeting = hour < 6 ? "Доброй ночи" : hour < 12 ? "Доброе утро" : hour < 18 ? "Добрый день" : "Добрый вечер";

  // Портфель = сумма по активным сделкам БЕЗ закрытых (ТЗ р.2, п.1);
  // каждая сделка входит один раз, архивные клиенты уже исключены выборкой.
  const activeDeals = dealOpts.filter((d) => d.stage !== "Закрытие");
  const portfolio = activeDeals.reduce((s, d) => s + (d.amount ?? 0), 0);

  // Поручения: задачи, которые поставил кто-то другой (руководитель).
  const assignedToMe = openTasks.filter((t) => t.assignedById && t.assignedById !== session.userId);

  return (
    <div>
      <PageHeader
        title={`${greeting}, ${session?.name.split(" ")[0] ?? ""}`}
        subtitle={now.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        icon="◆"
      />

      {/* Бенто-метрики: живые цифры досчитываются на глазах */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4 lg:grid-rows-2">
        <Link href="/finances" className="col-span-2 row-span-2">
          <div className="card card-hover flex h-full flex-col justify-center !border-brand/30 p-6">
            <div className="text-xs font-medium uppercase tracking-wide text-ink-400">
              Портфель под управлением
            </div>
            <div className="mt-3 font-display text-4xl font-semibold text-brand lg:text-5xl">
              <CountUp value={portfolio} suffix=" ₽" duration={1100} />
            </div>
            <div className="mt-2 text-sm text-ink-400">
              без НДС ≈ {formatMoney(netOfVat(portfolio))} · {activeDeals.length} активных сделок
            </div>
          </div>
        </Link>
        <StatCard label="Активные сделки" value={<CountUp value={dealCount} />} href="/deals" />
        <StatCard label="Задачи в работе" value={<CountUp value={activeTasks} />} href="/tasks" accent={activeTasks > 0} />
        <StatCard label="Рекламодатели" value={<CountUp value={advCount} />} href="/advertisers" />
        <StatCard label="Документы" value={<CountUp value={docCount} />} href="/documents" />
      </div>

      {/* Решения, которые ждут */}
      <section className="mb-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-bold text-ink-50">
            <span className="text-brand">◆</span> Решения, которые ждут вас
          </h2>
        </div>

        {/* Слева — кнопка вопроса, справа — статусы уже отправленных: раньше
            правая половина этой области пустовала. */}
        {!leader && (
          <div className="mb-3 grid gap-3 md:grid-cols-2">
            <AskLeaderButton
              advertisers={advertisers}
              deals={dealOpts}
              leaderAvatarUrl={leader_?.avatarUrl}
              leaderName={leader_?.name}
            />
            {decisionItems.length > 0 ? (
              <div className="card p-4">
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-500">
                  Мои вопросы
                </div>
                <MyDecisionRequests items={decisionItems.slice(0, 3)} />
              </div>
            ) : (
              <div className="card flex items-center p-4 text-xs text-ink-500">
                Отправленные вопросы и ответы на них появятся здесь.
              </div>
            )}
          </div>
        )}

        {/* Вопросы от сотрудников — у руководителя сверху, с кнопкой решения */}
        {leader && openRequests.length > 0 && (
          <div className="mb-3 grid gap-3 md:grid-cols-2">
            {openRequests.map((r) => (
              <DecisionRequestCard key={r.id} item={r} canDecide />
            ))}
          </div>
        )}



        {decisions.length === 0 && (leader ? openRequests.length === 0 : true) ? (
          <EmptyState
            compact
            icon="✅"
            title="Решать сейчас нечего"
            hint={leader ? "сотрудники ничего не спрашивали" : "всё под контролем"}
          />
        ) : decisions.length === 0 ? null : (
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

      {/* Поручения руководителя — видно сразу, не теряются среди задач */}
      {assignedToMe.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-ink-50">
            <span>🎯</span> Поручения руководителя
          </h2>
          <div className="grid gap-2 md:grid-cols-2">
            {assignedToMe.map((t) => (
              <Link
                key={t.id}
                href="/tasks"
                className="card card-hover flex items-start justify-between gap-3 p-4 !border-brand/25"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium text-ink-50">{t.title}</div>
                  <div className="mt-0.5 text-xs text-ink-400">
                    {t.advertiser?.nameRu ?? "без клиента"}
                    {t.assignedBy?.name ? ` · поручил ${t.assignedBy.name}` : ""}
                    {t.dueDate ? ` · до ${formatDate(t.dueDate)}` : ""}
                  </div>
                </div>
                <span className="badge badge-brand shrink-0">{t.status}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

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
                      {/* Комментарий из карточки задачи (правки/статус от клиента) — на контроль */}
                      {t.notes && (
                        <div className="mt-1 line-clamp-2 text-xs text-ink-400">💬 {t.notes}</div>
                      )}
                    </div>
                    {t.side === "Клиент" && (
                      <span className="badge shrink-0 bg-sky-500/15 text-sky-300 ring-1 ring-inset ring-sky-500/30">
                        🤝 у клиента
                      </span>
                    )}
                    {t.dueDate && (
                      <span className={`shrink-0 text-xs ${overdue ? "font-semibold text-red-300" : "text-ink-400"}`}>
                        {overdue ? "просрочено · " : ""}
                        {formatDate(t.dueDate)}
                      </span>
                    )}
                    <span className="badge badge-muted shrink-0">{t.status}</span>
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
              <EmptyState compact icon="🟢" title="Блокеров нет" />
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

      {/* Кольца стадий: где каждый проект на пути из 9 шагов */}
      {activeDeals.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-bold text-ink-50">Проекты на пути к закрытию</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {activeDeals.slice(0, 5).map((d) => (
              <Link key={d.id} href={`/deals/${d.id}`} className="card card-hover flex items-center gap-3 p-4">
                <StageRing stage={d.stage} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-ink-100">{d.advertiser.nameRu}</div>
                  <div className="mt-0.5 truncate text-xs text-ink-400">{d.stage}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Статус дня по проектам + недельный отчёт */}
      <div className="mb-8">
        <DailyStatusPanel advertisers={advertisers} deals={dealOpts} today={todayStatuses} />
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
