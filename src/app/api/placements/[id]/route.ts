import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok } from "@/lib/api";
import { placementUpdateSchema } from "@/lib/validation";
import { guardPlacement } from "@/lib/guard";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    const { id } = await ctx.params;
    await guardPlacement(session, id);
    const data = placementUpdateSchema.parse(await req.json());
    const placement = await prisma.placement.update({
      where: { id },
      data: {
        ...(data.slot !== undefined ? { slot: data.slot } : {}),
        ...(data.responsible !== undefined ? { responsible: data.responsible } : {}),
        ...(data.startDate ? { startDate: new Date(data.startDate) } : {}),
        ...(data.endDate ? { endDate: new Date(data.endDate) } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
      },
    });
    return ok(placement);
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    const { id } = await ctx.params;
    await guardPlacement(session, id);
    await prisma.placement.delete({ where: { id } });
    return ok({ ok: true });
  });
}
