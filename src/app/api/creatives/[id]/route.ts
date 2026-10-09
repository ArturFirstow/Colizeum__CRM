import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok } from "@/lib/api";
import { creativeUpdateSchema } from "@/lib/validation";
import { guardCreative } from "@/lib/guard";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    const { id } = await ctx.params;
    await guardCreative(session, id);
    const data = creativeUpdateSchema.parse(await req.json());
    const creative = await prisma.creative.update({ where: { id }, data });
    return ok(creative);
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    const { id } = await ctx.params;
    await guardCreative(session, id);
    await prisma.creative.delete({ where: { id } });
    return ok({ ok: true });
  });
}
