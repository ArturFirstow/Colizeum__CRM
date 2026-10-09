import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok } from "@/lib/api";
import { guardAgencyClient } from "@/lib/guard";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    const { id } = await ctx.params;
    await guardAgencyClient(session, id);
    await prisma.agencyClient.delete({ where: { id } });
    return ok({ ok: true });
  });
}
