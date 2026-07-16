import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok } from "@/lib/api";
import { creativeCreateSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  return withSession(async () => {
    const { id } = await ctx.params;
    const data = creativeCreateSchema.parse(await req.json());
    const creative = await prisma.creative.create({
      data: { advertiserId: id, title: data.title, size: data.size || undefined, status: data.status, dealId: data.dealId || undefined, notes: data.notes || undefined },
    });
    return ok(creative, { status: 201 });
  });
}
