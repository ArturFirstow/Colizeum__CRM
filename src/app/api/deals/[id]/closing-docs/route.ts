import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok } from "@/lib/api";
import { closingCreateSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  return withSession(async () => {
    const { id } = await ctx.params;
    const data = closingCreateSchema.parse(await req.json());
    const doc = await prisma.closingDoc.create({ data: { ...data, dealId: id } });
    return ok(doc, { status: 201 });
  });
}
