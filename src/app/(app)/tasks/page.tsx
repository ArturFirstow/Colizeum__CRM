import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { ownScope, advertiserScope } from "@/lib/scope";
import { taskScope } from "@/lib/task-scope";
import { TasksView } from "@/components/tasks/TasksView";
import { ClientWeek } from "@/components/tasks/ClientWeek";
import { ViewSwitch } from "@/components/tasks/ViewSwitch";

export const dynamic = "force-dynamic";

// Раздел «Задачи» — ОДИН список задач в двух видах:
//   доска       — на чьей стороне мяч (оперативка в течение дня);
//   по клиентам — недельная сверка с менеджером (бывший «Рабочий лист»).
// Вид выбирается адресом (?view=clients), чтобы ссылку можно было отправить
// коллеге и чтобы прежние закладки на /worksheet никуда не делись.

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; week?: string; owner?: string }>;
}) {
  const { view, week, owner } = await searchParams;

  if (view === "clients") {
    return <ClientWeek week={week} owner={owner} viewSwitch={<ViewSwitch view="clients" />} />;
  }

  // Личный кабинет: только свои задачи и справочники своих клиентов.
  const session = await requireSession();
  const [tasks, deals, advertisers, users] = await Promise.all([
    prisma.task.findMany({
      where: taskScope(session),
      include: {
        deal: { select: { id: true, title: true, advertiser: { select: { id: true, nameRu: true } } } },
        advertiser: { select: { id: true, nameRu: true } },
        assignee: { select: { id: true, name: true } },
        assignedBy: { select: { id: true, name: true } },
      },
      orderBy: [{ movedAt: "desc" }, { dueDate: "asc" }],
    }),
    prisma.deal.findMany({ where: advertiserScope(session), select: { id: true, title: true, advertiserId: true }, orderBy: { updatedAt: "desc" } }),
    prisma.advertiser.findMany({ where: ownScope(session), select: { id: true, nameRu: true }, orderBy: { nameRu: "asc" } }),
    prisma.user.findMany({ where: { role: { not: "Security" } }, select: { id: true, name: true } }),
  ]);

  return (
    <TasksView
      tasks={tasks.map((t) => ({ ...t, advertiser: t.deal?.advertiser ?? t.advertiser }))}
      deals={deals}
      advertisers={advertisers}
      users={users}
      viewSwitch={<ViewSwitch view="board" />}
    />
  );
}
