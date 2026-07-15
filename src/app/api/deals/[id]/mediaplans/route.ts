import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok } from "@/lib/api";
import { mediaPlanCreateSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  return withSession(async () => {
    const { id } = await ctx.params;
    const { lines, ...plan } = mediaPlanCreateSchema.parse(await req.json());

    // Автоподсчёт итога, если не задан явно.
    const computedTotal = (lines ?? []).reduce((s, l) => s + (l.sum ?? 0), 0);

    const mediaPlan = await prisma.mediaPlan.create({
      data: {
        ...plan,
        dealId: id,
        totalAmount: plan.totalAmount ?? (computedTotal || undefined),
        lines: lines && lines.length ? { create: lines } : undefined,
      },
      include: { lines: true },
    });
    return ok(mediaPlan, { status: 201 });
  });
}
