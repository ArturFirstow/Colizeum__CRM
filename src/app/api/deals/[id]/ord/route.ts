import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok } from "@/lib/api";
import { ordCreateSchema } from "@/lib/validation";
import { guardDeal } from "@/lib/guard";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    const { id } = await ctx.params;
    await guardDeal(session, id);
    const data = ordCreateSchema.parse(await req.json());
    const ord = await prisma.ordMarking.create({
      data: { ...data, dealId: id, markedAt: new Date() },
    });
    return ok(ord, { status: 201 });
  });
}
