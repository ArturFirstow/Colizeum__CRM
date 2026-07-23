import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok, fail } from "@/lib/api";
import { isLeadership } from "@/lib/scope";
import { deptIncomeSchema } from "@/lib/validation";

// Доход по источнику за месяц: один ряд на пару (месяц + источник).
export async function POST(req: NextRequest) {
  return withSession(async (session) => {
    if (!isLeadership(session)) return fail("forbidden", "Доступно только руководителю", 403);
    const data = deptIncomeSchema.parse(await req.json());
    const income = await prisma.deptIncome.create({
      data: {
        month: data.month,
        source: data.source,
        w1: data.w1 ?? 0,
        w2: data.w2 ?? 0,
        w3: data.w3 ?? 0,
        w4: data.w4 ?? 0,
      },
    });
    return ok(income, { status: 201 });
  });
}
