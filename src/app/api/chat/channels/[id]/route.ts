import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok } from "@/lib/api";
import { guardChannelDelete } from "@/lib/guard";

type Ctx = { params: Promise<{ id: string }> };

// Удалить канал (кроме «Общего»). Сообщения и вложения удаляются каскадом.
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    const { id } = await ctx.params;
    // Личку сносит только её участник, общий канал — создатель или админ.
    await guardChannelDelete(session, id);
    await prisma.channel.delete({ where: { id } });
    return ok({ ok: true });
  });
}
