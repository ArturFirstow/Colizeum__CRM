import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok } from "@/lib/api";
import { taskUpdateSchema } from "@/lib/validation";
import { guardTask } from "@/lib/guard";
import { updateTask } from "@/lib/services/tasks";
import { writeAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/services/notify";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    const { id } = await ctx.params;
    const previous = await guardTask(session, id);
    const data = taskUpdateSchema.parse(await req.json());
    const task = await updateTask(session, id, data);
    writeAudit({ userId: session.userId, action: "task.update", entityType: "Task", entityId: id, changedFields: Object.keys(data) });
    if (task.assigneeId && task.assigneeId !== previous.assigneeId && task.assigneeId !== session.userId) {
      void notifyUser(task.assigneeId, `🎯 ${session.name} передал вам задачу: ${task.title}`).catch(() => {});
    }
    return ok(task);
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    const { id } = await ctx.params;
    await guardTask(session, id);
    await prisma.task.delete({ where: { id } });
    return ok({ ok: true });
  });
}
