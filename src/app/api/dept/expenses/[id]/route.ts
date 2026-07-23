import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok, fail } from "@/lib/api";
import { isLeadership } from "@/lib/scope";
import { deptExpenseUpdateSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };
const d = (v?: string) => (v === undefined ? undefined : v ? new Date(v) : null);

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    if (!isLeadership(session)) return fail("forbidden", "Доступно только руководителю", 403);
    const { id } = await ctx.params;
    const { payDate, deliveryDate, serviceEndDate, actClosedDate, ...rest } =
      deptExpenseUpdateSchema.parse(await req.json());
    const expense = await prisma.deptExpense.update({
      where: { id },
      data: {
        ...rest,
        ...(payDate !== undefined ? { payDate: d(payDate) } : {}),
        ...(deliveryDate !== undefined ? { deliveryDate: d(deliveryDate) } : {}),
        ...(serviceEndDate !== undefined ? { serviceEndDate: d(serviceEndDate) } : {}),
        ...(actClosedDate !== undefined ? { actClosedDate: d(actClosedDate) } : {}),
      },
    });
    return ok(expense);
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    if (!isLeadership(session)) return fail("forbidden", "Доступно только руководителю", 403);
    const { id } = await ctx.params;
    await prisma.deptExpense.delete({ where: { id } });
    return ok({ ok: true });
  });
}
