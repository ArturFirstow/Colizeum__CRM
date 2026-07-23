import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok, fail } from "@/lib/api";
import { isLeadership } from "@/lib/scope";
import { deptBudgetSchema } from "@/lib/validation";

// Планируемый бюджет расходов на месяц — один ряд на месяц (upsert).
export async function PUT(req: NextRequest) {
  return withSession(async (session) => {
    if (!isLeadership(session)) return fail("forbidden", "Доступно только руководителю", 403);
    const data = deptBudgetSchema.parse(await req.json());
    const budget = await prisma.deptMonthBudget.upsert({
      where: { month: data.month },
      update: { plannedBudget: data.plannedBudget },
      create: { month: data.month, plannedBudget: data.plannedBudget },
    });
    return ok(budget);
  });
}
