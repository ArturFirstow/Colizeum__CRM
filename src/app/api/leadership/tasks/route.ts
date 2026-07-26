import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok, fail } from "@/lib/api";
import { isLeadership } from "@/lib/scope";
import { leadershipTaskSchema } from "@/lib/validation";

// Руководитель ставит задачу-поручение конкретному сотруднику.
// Задача попадает в кабинет сотрудника (ownerId = сотрудник), помечена
// «от руководителя» (assignedById = руководитель).
export async function POST(req: NextRequest) {
  return withSession(async (session) => {
    if (!isLeadership(session)) return fail("forbidden", "Ставить поручения может только руководитель", 403);
    const data = leadershipTaskSchema.parse(await req.json());

    const assignee = await prisma.user.findUnique({ where: { id: data.assigneeId }, select: { id: true } });
    if (!assignee) return fail("not_found", "Сотрудник не найден", 404);

    const task = await prisma.task.create({
      data: {
        title: data.title,
        kind: data.kind ?? "Менеджер",
        advertiserId: data.advertiserId || undefined,
        assigneeId: assignee.id,
        ownerId: assignee.id,
        assignedById: session.userId,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        notes: data.notes || undefined,
        side: "Мы",
        status: "Открыта",
      },
    });
    return ok(task, { status: 201 });
  });
}
