import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

// Отметить «решение принятым» — очищает decisionPending (блупринт 6.1).
export async function POST(_req: NextRequest, ctx: Ctx) {
  return withSession(async () => {
    const { id } = await ctx.params;
    const deal = await prisma.deal.update({
      where: { id },
      data: { decisionPending: null },
    });
    return ok(deal);
  });
}
