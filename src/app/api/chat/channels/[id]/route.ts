import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok, fail } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

// Удалить канал (кроме «Общего»). Сообщения и вложения удаляются каскадом.
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return withSession(async () => {
    const { id } = await ctx.params;
    const channel = await prisma.channel.findUnique({ where: { id } });
    if (!channel) return fail("not_found", "Канал не найден", 404);
    if (channel.isGeneral) return fail("forbidden", "«Общий» канал удалить нельзя", 400);
    await prisma.channel.delete({ where: { id } });
    return ok({ ok: true });
  });
}
