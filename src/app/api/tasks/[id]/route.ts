import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok } from "@/lib/api";
import { taskUpdateSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return withSession(async () => {
    const { id } = await ctx.params;
    const data = taskUpdateSchema.parse(await req.json());
    // Перетащили в другую колонку — карточка встаёт первой, иначе теряется
    // в середине списка и человек её больше не находит.
    const movedAt = data.status !== undefined ? { movedAt: new Date() } : {};
    const task = await prisma.task.update({
      where: { id },
      data: { ...data, ...movedAt, dueDate: data.dueDate ? new Date(data.dueDate) : undefined },
    });
    return ok(task);
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return withSession(async () => {
    const { id } = await ctx.params;
    await prisma.task.delete({ where: { id } });
    return ok({ ok: true });
  });
}
