import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok } from "@/lib/api";
import { taskCreateSchema } from "@/lib/validation";
import { guardAdvertiser, guardDeal } from "@/lib/guard";
import { notifyUser } from "@/lib/services/notify";

export async function POST(req: NextRequest) {
  return withSession(async (session) => {
    const data = taskCreateSchema.parse(await req.json());

    // Задачу можно завести только по своему клиенту и своей сделке — иначе,
    // зная идентификатор, можно было бы прицепить запись к чужой карточке.
    if (data.advertiserId) await guardAdvertiser(session, data.advertiserId);
    if (data.dealId) await guardDeal(session, data.dealId);

    // Поручили коллеге — запоминаем, кто поручил. На доске у исполнителя такая
    // задача помечается, и в рабочем листе видно, что это не его личное дело.
    const delegated = data.assigneeId && data.assigneeId !== session.userId;

    const task = await prisma.task.create({
      data: {
        ...data,
        ownerId: session.userId,
        assignedById: delegated ? session.userId : undefined,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      },
    });

    if (delegated && data.assigneeId) {
      const due = task.dueDate ? ` (срок ${task.dueDate.toLocaleDateString("ru-RU")})` : "";
      void notifyUser(data.assigneeId, `🎯 ${session.name} поставил задачу: ${task.title}${due}`).catch(
        () => {},
      );
    }

    return ok(task, { status: 201 });
  });
}
