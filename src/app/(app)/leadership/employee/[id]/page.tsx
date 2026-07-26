import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { isLeadership } from "@/lib/scope";
import { PageHeader, StageBadge, UrgencyBadge, EmptyState } from "@/components/ui/primitives";
import { formatMoney, formatDate, netOfVat } from "@/lib/format";
import { ROLE_LABELS, type Role } from "@/lib/enums";
import { taskStatusStyle } from "@/lib/ui-tokens";
import { AssignTaskButton } from "@/components/leadership/AssignTaskButton";

export const dynamic = "force-dynamic";

export default async function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!isLeadership(session)) redirect("/dashboard");
  const { id } = await params;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) notFound();

  const [advertisers, deals, tasks, statuses, assignedByMe] = await Promise.all([
    prisma.advertiser.findMany({ where: { ownerId: id, archived: false }, orderBy: { nameRu: "asc" } }),
    prisma.deal.findMany({
      where: { advertiser: { ownerId: id, archived: false } },
      include: { advertiser: { select: { nameRu: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.task.findMany({
      where: { ownerId: id, status: { not: "Готова" } },
      orderBy: [{ dueDate: "asc" }],
      take: 10,
    }),
    prisma.dailyStatus.findMany({
      where: { advertiser: { ownerId: id } },
      include: { advertiser: { select: { nameRu: true } } },
      orderBy: { date: "desc" },
      take: 6,
    }),
    // Поручения, которые этот руководитель поставил данному сотруднику.
    prisma.task.findMany({
      where: { ownerId: id, assignedById: session.userId },
      include: { advertiser: { select: { nameRu: true } } },
      orderBy: [{ createdAt: "desc" }],
      take: 20,
    }),
  ]);

  const portfolio = deals.filter((d) => d.stage !== "Закрытие").reduce((s, d) => s + (d.amount ?? 0), 0);

  return (
    <div>
      <Link href="/leadership" className="mb-4 inline-flex text-sm text-ink-400 hover:text-brand">
        ← Обзор отдела
      </Link>
      <PageHeader
        title={user.name}
        subtitle={`${ROLE_LABELS[user.role as Role] ?? user.role} · просмотр + поручения`}
        icon="👤"
        actions={
          user.id !== session.userId ? (
            <AssignTaskButton
              employee={{ id: user.id, name: user.name }}
              clients={advertisers.map((a) => ({ id: a.id, nameRu: a.nameRu }))}
            />
          ) : undefined
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Mini label="Клиентов" value={String(advertisers.length)} />
        <Mini label="Сделок" value={String(deals.length)} />
        <Mini label="Портфель" value={formatMoney(portfolio)} sub={`без НДС ≈ ${formatMoney(netOfVat(portfolio))}`} />
        <Mini label="Задач в работе" value={String(tasks.length)} />
      </div>

      {/* Поручения от руководителя этому сотруднику */}
      <section className="card mb-6 p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-ink-50">Поручения от вас</h2>
          <span className="text-xs text-ink-500">
            {assignedByMe.filter((t) => t.status !== "Готова").length} в работе · {assignedByMe.length} всего
          </span>
        </div>
        {assignedByMe.length === 0 ? (
          <p className="text-sm text-ink-400">
            Пока нет поручений. Нажмите «Поручить задачу» вверху — она попадёт в кабинет сотрудника.
          </p>
        ) : (
          <div className="space-y-2">
            {assignedByMe.map((t) => {
              const overdue = t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "Готова";
              return (
                <div key={t.id} className="flex items-start justify-between gap-3 rounded-xl border border-ink-800 bg-ink-900/50 px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-ink-100">{t.title}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-500">
                      {t.advertiser && <span>клиент: {t.advertiser.nameRu}</span>}
                      {t.dueDate && (
                        <span className={overdue ? "font-semibold text-red-300" : ""}>
                          {overdue ? "⚠ срок " : "⏰ срок "}
                          {formatDate(t.dueDate)}
                        </span>
                      )}
                    </div>
                    {t.notes && <p className="mt-1 whitespace-pre-wrap text-xs text-ink-400">{t.notes}</p>}
                  </div>
                  <span className={`pill shrink-0 ring-1 ring-inset ${taskStatusStyle(t.status)}`}>{t.status}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Клиенты и сделки */}
        <section className="card p-5">
          <h2 className="mb-3 text-lg font-bold text-ink-50">Клиенты и сделки</h2>
          {deals.length === 0 ? (
            <EmptyState icon="⑂" title="Сделок нет" />
          ) : (
            <div className="space-y-2">
              {deals.map((d) => (
                <div key={d.id} className="rounded-xl border border-ink-800 bg-ink-900/50 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-ink-100">{d.advertiser.nameRu}</div>
                      <div className="truncate text-xs text-ink-400">{d.title}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <UrgencyBadge urgency={d.urgency} />
                      <StageBadge stage={d.stage} />
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-ink-400">
                    {d.amount != null ? formatMoney(d.amount) : "—"}
                    {d.blocker && <span className="text-red-300"> · ⛔ {d.blocker}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Задачи + активность */}
        <section className="space-y-6">
          <div className="card p-5">
            <h2 className="mb-3 text-lg font-bold text-ink-50">Задачи в работе</h2>
            {tasks.length === 0 ? (
              <p className="text-sm text-ink-400">Открытых задач нет.</p>
            ) : (
              <div className="space-y-2">
                {tasks.map((t) => {
                  const overdue = t.dueDate && new Date(t.dueDate) < new Date();
                  return (
                    <div key={t.id} className="flex items-center justify-between gap-2 rounded-lg bg-ink-900/50 px-3 py-2 text-sm">
                      <span className="truncate text-ink-200">{t.title}</span>
                      {t.dueDate && (
                        <span className={`shrink-0 text-xs ${overdue ? "text-red-300" : "text-ink-500"}`}>
                          {formatDate(t.dueDate)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="card p-5">
            <h2 className="mb-3 text-lg font-bold text-ink-50">Последняя активность</h2>
            {statuses.length === 0 ? (
              <p className="text-sm text-ink-400">Статусов пока нет.</p>
            ) : (
              <div className="space-y-2">
                {statuses.map((s) => (
                  <div key={s.id} className="surface p-3 text-sm">
                    <div className="mb-0.5 flex items-center gap-2 text-xs text-ink-500">
                      {formatDate(s.date)} · {s.advertiser.nameRu}
                    </div>
                    <div className="text-ink-300">{s.text}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Mini({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-ink-400">{label}</div>
      <div className="mt-1.5 font-display text-xl font-semibold text-ink-50">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-500">{sub}</div>}
    </div>
  );
}
