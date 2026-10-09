import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok, fail } from "@/lib/api";
import { advertiserUpdateSchema } from "@/lib/validation";
import { guardAdvertiser } from "@/lib/guard";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    const { id } = await ctx.params;
    await guardAdvertiser(session, id);
    const advertiser = await prisma.advertiser.findUnique({
      where: { id },
      include: { contacts: true, deals: true, documents: true },
    });
    if (!advertiser) return fail("not_found", "Рекламодатель не найден", 404);
    return ok(advertiser);
  });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    const { id } = await ctx.params;
    await guardAdvertiser(session, id);
    const data = advertiserUpdateSchema.parse(await req.json());
    const advertiser = await prisma.advertiser.update({ where: { id }, data });
    return ok(advertiser);
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    const { id } = await ctx.params;
    await guardAdvertiser(session, id);
    await prisma.advertiser.delete({ where: { id } });
    return ok({ ok: true });
  });
}
