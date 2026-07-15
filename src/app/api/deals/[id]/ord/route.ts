import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok } from "@/lib/api";
import { ordCreateSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  return withSession(async () => {
    const { id } = await ctx.params;
    const data = ordCreateSchema.parse(await req.json());
    const ord = await prisma.ordMarking.create({
      data: { ...data, dealId: id, markedAt: new Date() },
    });
    return ok(ord, { status: 201 });
  });
}
