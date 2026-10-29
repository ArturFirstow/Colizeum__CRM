import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { sumMoney, toGross } from "@/components/ui/Money";
import { BUDGET_HINT, BUDGET_LABEL, budgetRows, isActiveForBudget } from "@/lib/budget";
import { PageHeader, EmptyState, StageBadge, UrgencyBadge } from "@/components/ui/primitives";
import { DecisionButton } from "@/components/deals/DecisionButton";
import { DailyStatusPanel } from "@/components/dashboard/DailyStatusPanel";
import { AskLeaderButton, DecisionRequestCard, MyDecisionRequests, type DecisionItem } from "@/components/dashboard/DecisionRequests";
import { formatMoney, formatDate, daysBetween } from "@/lib/format";
import { TASK_KIND_EMOJI } from "@/lib/ui-tokens";
import { requireSession } from "@/lib/auth";
import { ownScope, isLeadership } from "@/lib/scope";
import { CountUp } from "@/components/ui/CountUp";

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
    // Архивные вопросы не показываем: автор убрал их сам, прочитав ответ.
    where: leader
      ? { status: "Открыт", archivedAt: null }
      : { requesterId: session.userId, archivedAt: null },
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
    resolvedAt: r.resolvedAt?.toISOString() ?? null,
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
    // ⚠️ Считаем не «сколько у нас всего», а «что требует решения». Прежние
    // плитки («бюджет», «активные сделки», «задачи в работе») были витриной:
    // по ним нельзя было ничего решить, а две из трёх показывали одно и то же
    // число. Теперь три числа отвечают на три вопроса рабочего утра:
    // что просрочено, что ждёт меня, что ждёт клиента.
    Promise.all([
      prisma.task.count({
        where: { status: { not: "Готова" }, dueDate: { lt: todayStart }, ...myTask },
      }),
      prisma.task.count({
        where: { status: { not: "Готова" }, side: { not: "Клиент" }, ...myTask },
      }),
      prisma.task.count({
        where: { status: { not: "Готова" }, side: "Клиент", ...myTask },
      }),
    ]),
    prisma.advertiser.findMany({ where: { archived: false, ...ownScope(session) }, select: { id: true, nameRu: true }, orderBy: { nameRu: "asc" } }),
    prisma.deal.findMany({
      where: notArchived,
      select: { id: true, title: true, advertiserId: true, stage: true, amount: true, contractTotal: true, vatIncluded: true, contractDate: true, advertiser: { select: { nameRu: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.dailyStatus.findMany({
      where: { date: { gte: todayStart }, advertiser: ownScope(session) },
      include: { advertiser: { select: { nameRu: true } }, deal: { select: { title: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const [overdueTasks, mySideTasks, clientSideTasks] = counts;
  const hour = now.getHours();
  const greeting = hour < 6 ? "Доброй ночи" : hour < 12 ? "Доброе утро" : hour < 18 ? "Добрый день" : "Добрый вечер";

  // Портфель = сумма по активным сделкам БЕЗ закрытых (ТЗ р.2, п.1);
  // каждая сделка входит один раз, архивные клиенты уже исключены выборкой.
  // Бюджет считается ровно так же, как в разделе «Оплаты» — одно определение
  // на весь сервис лежит в src/lib/budget.ts. Раньше здесь складывались суммы
  // из медиапланов, а там — по договорам, и заголовки расходились.
  const activeDeals = dealOpts.filter(isActiveForBudget);
  const portfolio = sumMoney(budgetRows(dealOpts));

  // Поручения: задачи, которые поставил кто-то другой (руководитель).
  const assignedToMe = openTasks.filter((t) => t.assignedById && t.assignedById !== session.userId);

  return (
    <div>
      <PageHeader
        title={`${greeting}, ${session?.name.split(" ")[0] ?? ""}`}
        subtitle={now.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        icon="◆"
      />

      {/* ⚠️ Витрина цифр заменена на три решения. Главная цифра дня — не
          бюджет (по нему нельзя ничего сделать прямо сейчас), а то, где
          работа стоит: просрочено / ждёт нас / ждёт клиента. Бюджет остался
          справа спокойной карточкой — он справочный. */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3 xl:grid-cols-4">
        <DecisionTile
          label="Просрочено"
          value={overdueTasks}
          hint={overdueTasks > 0 ? "сроки уже прошли" : "сроки не нарушены"}
          href="/tasks"
          tone={overdueTasks > 0 ? "danger" : "calm"}
        />
        <DecisionTile
          label="Ждут вас"
          value={mySideTasks}
          hint="наша сторона: делаем и согласуем мы"
          href="/tasks"
          tone={mySideTasks > 0 ? "accent" : "calm"}
        />
        <DecisionTile
          label="Ждём клиента"
          value={clientSideTasks}
          hint="ответ, правки, подписание на их стороне"
          href="/tasks"
          tone="calm"
        />
        <Link href="/finances" className="sm:col-span-3 xl:col-span-1">
          <div className="card card-hover flex h-full flex-col justify-center p-5">
            <div className="text-xs font-medium uppercase tracking-wide text-ink-500">
              {BUDGET_LABEL}
            </div>
            {/* Как и везде: крупно сумма с НДС, чистая — подписью. */}
            <div className="mt-1.5 font-display text-2xl font-semibold text-brand">
              <CountUp value={portfolio.gross} suffix=" ₽" duration={900} />
            </div>
            <div className="mt-1 text-xs text-ink-500">
              без НДС ≈ {formatMoney(portfolio.net)} · {activeDeals.length} активных сделок
            </div>
          </div>
        </Link>
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
        {/* ⚠️ Пустая карточка «Отправленные вопросы появятся здесь» убрана.
            Она занимала половину ширины ради фразы, которая ничего не меняет,
            и шла сразу перед второй надписью о том же самом («Решать сейчас
            нечего»). Пока вопросов нет — кнопка просто занимает всю строку. */}
        {!leader && (
          <div className={`mb-3 grid gap-3 ${decisionItems.length > 0 ? "md:grid-cols-2" : ""}`}>
            <AskLeaderButton
              advertisers={advertisers}
              deals={dealOpts}
              leaderAvatarUrl={leader_?.avatarUrl}
              leaderName={leader_?.name}
            />
            {decisionItems.length > 0 && (
              <div className="card p-4">
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-500">
                  Мои вопросы
                </div>
                <MyDecisionRequests items={decisionItems.slice(0, 3)} />
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



        {/* «Решать нечего» показываем только руководителю: ему важно видеть,
            что очередь вопросов пуста. Сотруднику эта строка шла сразу под
            кнопкой «Спросить руководителя» и повторяла её смысл. */}
        {decisions.length === 0 && leader && openRequests.length === 0 ? (
          <EmptyState compact icon="✅" title="Решать сейчас нечего" hint="сотрудники ничего не спрашивали" />
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

      {/* Статус дня наверху: при десятке задач он уезжал в самый низ страницы,
          хотя заполнять его нужно каждый день. */}
      <div className="mb-8">
        <DailyStatusPanel advertisers={advertisers} deals={dealOpts} today={todayStatuses} />
      </div>

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
        <section className="min-w-0 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-ink-50">Ближайшие задачи</h2>
            <Link href="/tasks" className="-my-1 rounded px-1.5 py-1 text-sm text-brand transition hover:bg-brand/10 hover:underline">
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
        <section className="min-w-0 space-y-6">
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
              {/* ⚠️ Была голая стрелка 15×21 — и непонятно, куда ведёт, и
                  попасть трудно. Теперь это обычная ссылка со словами. */}
              <Link href="/journal" className="-my-1 rounded px-1.5 py-1 text-sm text-brand transition hover:bg-brand/10 hover:underline">
                Все записи →
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

      {/* ⚠️ Блок «Проекты на пути к закрытию» (кольца стадий) убран: у всех
          пяти сделок кольцо выглядело одинаково («2/5 Договор»), решения по
          нему не принимались, а те же пять сделок уже перечислены ниже в
          «Зависли дольше 7 дней» и в задачах. Воронка по стадиям живёт в
          «Сделках» и в обзоре отдела — там она и уместна. */}

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
                  {d.amount != null && (
                    <span className="text-xs text-ink-400">
                      {formatMoney(toGross(d.amount, d.contractDate, d.vatIncluded))}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Плитка решения: крупное число, слово под ним и объяснение одной строкой.
// Цвет несёт смысл: красный — просрочка, жёлтый — работа на нашей стороне,
// серый — ждём не мы. Ноль не красится: пустая очередь — это хорошо.
// ─────────────────────────────────────────────────────────────────────────────
function DecisionTile({
  label,
  value,
  hint,
  href,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  href: string;
  tone: "danger" | "accent" | "calm";
}) {
  const border =
    value === 0
      ? "!border-ink-800"
      : tone === "danger"
        ? "!border-red-500/40"
        : tone === "accent"
          ? "!border-brand/35"
          : "!border-ink-700";
  const color =
    value === 0
      ? "text-ink-500"
      : tone === "danger"
        ? "text-red-300"
        : tone === "accent"
          ? "text-brand"
          : "text-ink-100";
  return (
    <Link href={href}>
      <div className={`card card-hover flex h-full flex-col justify-center p-5 ${border}`}>
        <div className="text-xs font-medium uppercase tracking-wide text-ink-400">{label}</div>
        <div className={`mt-1 font-display text-4xl font-semibold ${color}`}>
          <CountUp value={value} duration={700} />
        </div>
        <div className="mt-1 text-xs text-ink-500">{hint}</div>
      </div>
    </Link>
  );
}
