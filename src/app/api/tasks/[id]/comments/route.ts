import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok } from "@/lib/api";
import { taskCommentSchema } from "@/lib/validation";
import { guardTask } from "@/lib/guard";
import { notifyUser } from "@/lib/services/notify";

type Ctx = { params: Promise<{ id: string }> };

// ─────────────────────────────────────────────────────────────────────────────
// Переписка по задаче между руководителем проекта и проектным менеджером.
//
// Раньше это жило приписками в Google-документе: «ГОТОВО», «ЖДЁМ ОТВЕТ
// КЛИЕНТА», «НАСТЯ СМОТРИТ» — дописанными прямо в текст пункта. Кто и когда
// написал, восстановить было нельзя, а при правке формулировки комментарий
// затирался вместе с ней.
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    const { id } = await ctx.params;
    await guardTask(session, id);
    const { text } = taskCommentSchema.parse(await req.json());

    const comment = await prisma.taskComment.create({
      data: { taskId: id, authorId: session.userId, text },
      include: { author: { select: { name: true } } },
    });

    // Второй стороне — всплывашка и Telegram: смысл листа в том, что ответ
    // виден сразу, а не на следующей планёрке.
    const task = await prisma.task.findUnique({
      where: { id },
      select: { title: true, ownerId: true, assigneeId: true },
    });
    const others = [task?.ownerId, task?.assigneeId].filter(
      (uid): uid is string => !!uid && uid !== session.userId,
    );
    // Не ждём отправку: Telegram может быть недоступен, а комментарий уже
    // сохранён — ронять запрос из-за уведомления нельзя.
    for (const uid of [...new Set(others)]) {
      void notifyUser(
        uid,
        `💬 ${session.name} по задаче «${task?.title ?? ""}»:\n\n${text.slice(0, 400)}`,
      ).catch(() => {});
    }

    return ok(comment, { status: 201 });
  });
}
