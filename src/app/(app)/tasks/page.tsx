import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { ownScope, advertiserScope } from "@/lib/scope";
import { TasksView } from "@/components/tasks/TasksView";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  // Личный кабинет: только свои задачи и справочники своих клиентов.
  const session = await requireSession();
  const [tasks, deals, advertisers, users] = await Promise.all([
    prisma.task.findMany({
      where: ownScope(session),
      include: {
        deal: { select: { id: true, title: true } },
        advertiser: { select: { id: true, nameRu: true } },
        assignee: { select: { id: true, name: true } },
        assignedBy: { select: { id: true, name: true } },
      },
      orderBy: [{ movedAt: "desc" }, { dueDate: "asc" }],
    }),
    prisma.deal.findMany({ where: advertiserScope(session), select: { id: true, title: true }, orderBy: { updatedAt: "desc" } }),
    prisma.advertiser.findMany({ where: ownScope(session), select: { id: true, nameRu: true }, orderBy: { nameRu: "asc" } }),
    prisma.user.findMany({ select: { id: true, name: true } }),
  ]);

  return <TasksView tasks={tasks} deals={deals} advertisers={advertisers} users={users} />;
}
