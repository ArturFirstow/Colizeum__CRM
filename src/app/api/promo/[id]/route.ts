import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok } from "@/lib/api";
import { guardPromo } from "@/lib/guard";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    const { id } = await ctx.params;
    await guardPromo(session, id);
    await prisma.promoBatch.delete({ where: { id } });
    return ok({ ok: true });
  });
}
