import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok, fail } from "@/lib/api";
import { isLeadership } from "@/lib/scope";
import { deptExpenseSchema } from "@/lib/validation";

const d = (v?: string) => (v ? new Date(v) : undefined);

// Бюджет отдела — только руководитель/админ.
export async function POST(req: NextRequest) {
  return withSession(async (session) => {
    if (!isLeadership(session)) return fail("forbidden", "Доступно только руководителю", 403);
    const data = deptExpenseSchema.parse(await req.json());
    const expense = await prisma.deptExpense.create({
      data: {
        ...data,
        payDate: d(data.payDate),
        deliveryDate: d(data.deliveryDate),
        serviceEndDate: d(data.serviceEndDate),
        actClosedDate: d(data.actClosedDate),
      },
    });
    return ok(expense, { status: 201 });
  });
}
