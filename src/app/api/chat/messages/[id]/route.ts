import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok, fail } from "@/lib/api";
import { chatMessagePatchSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

// Закрепить/открепить или отредактировать сообщение.
export async function PATCH(req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    const { id } = await ctx.params;
    const msg = await prisma.chatMessage.findUnique({ where: { id } });
    if (!msg) return fail("not_found", "Сообщение не найдено", 404);
    const data = chatMessagePatchSchema.parse(await req.json());
    // Текст правит только автор; закреплять может любой сотрудник.
    if (data.body !== undefined && msg.authorId !== session.userId) {
      return fail("forbidden", "Редактировать может только автор", 403);
    }
    const updated = await prisma.chatMessage.update({
      where: { id },
      data: {
        ...(data.pinned !== undefined ? { pinned: data.pinned } : {}),
        ...(data.body !== undefined ? { body: data.body, editedAt: new Date() } : {}),
      },
    });
    return ok(updated);
  });
}

// Удалить сообщение (автор или админ).
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    const { id } = await ctx.params;
    const msg = await prisma.chatMessage.findUnique({ where: { id } });
    if (!msg) return fail("not_found", "Сообщение не найдено", 404);
    if (msg.authorId !== session.userId && session.role !== "Owner") {
      return fail("forbidden", "Удалить может автор или администратор", 403);
    }
    await prisma.chatMessage.delete({ where: { id } });
    return ok({ ok: true });
  });
}
