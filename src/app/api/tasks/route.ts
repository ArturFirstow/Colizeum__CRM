import { NextRequest } from "next/server";
import { withSession, ok } from "@/lib/api";
import { taskCreateSchema } from "@/lib/validation";
import { createTask } from "@/lib/services/tasks";
import { writeAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/services/notify";

export async function POST(req: NextRequest) {
  return withSession(async (session) => {
    const data = taskCreateSchema.parse(await req.json());

    // Поручили коллеге — запоминаем, кто поручил. На доске у исполнителя такая
    // задача помечается, и в рабочем листе видно, что это не его личное дело.
    const delegated = data.assigneeId && data.assigneeId !== session.userId;

    const task = await createTask(session, data);
    writeAudit({ userId: session.userId, action: "task.create", entityType: "Task", entityId: task.id, changedFields: Object.keys(data) });

    if (delegated && data.assigneeId) {
      const due = task.dueDate ? ` (срок ${task.dueDate.toLocaleDateString("ru-RU")})` : "";
      void notifyUser(data.assigneeId, `🎯 ${session.name} поставил задачу: ${task.title}${due}`).catch(
        () => {},
      );
    }

    return ok(task, { status: 201 });
  });
}
