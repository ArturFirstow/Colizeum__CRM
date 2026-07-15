import { prisma } from "@/lib/prisma";
import { TasksView } from "@/components/tasks/TasksView";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const [tasks, deals, advertisers, users] = await Promise.all([
    prisma.task.findMany({
      include: {
        deal: { select: { id: true, title: true } },
        advertiser: { select: { id: true, nameRu: true } },
        assignee: { select: { id: true, name: true } },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    }),
    prisma.deal.findMany({ select: { id: true, title: true }, orderBy: { updatedAt: "desc" } }),
    prisma.advertiser.findMany({ select: { id: true, nameRu: true }, orderBy: { nameRu: "asc" } }),
    prisma.user.findMany({ select: { id: true, name: true } }),
  ]);

  return <TasksView tasks={tasks} deals={deals} advertisers={advertisers} users={users} />;
}
