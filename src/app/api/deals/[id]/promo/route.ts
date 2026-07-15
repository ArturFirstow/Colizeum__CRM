import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok } from "@/lib/api";
import { promoCreateSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  return withSession(async () => {
    const { id } = await ctx.params;
    const data = promoCreateSchema.parse(await req.json());
    const promo = await prisma.promoBatch.create({ data: { ...data, dealId: id } });
    return ok(promo, { status: 201 });
  });
}
