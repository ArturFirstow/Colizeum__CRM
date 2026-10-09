import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok } from "@/lib/api";
import { closingCreateSchema } from "@/lib/validation";
import { guardDeal } from "@/lib/guard";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    const { id } = await ctx.params;
    await guardDeal(session, id);
    const data = closingCreateSchema.parse(await req.json());
    const doc = await prisma.closingDoc.create({ data: { ...data, dealId: id } });
    return ok(doc, { status: 201 });
  });
}
