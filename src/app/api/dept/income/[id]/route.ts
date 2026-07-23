import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok, fail } from "@/lib/api";
import { isLeadership } from "@/lib/scope";
import { deptIncomeUpdateSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    if (!isLeadership(session)) return fail("forbidden", "Доступно только руководителю", 403);
    const { id } = await ctx.params;
    const data = deptIncomeUpdateSchema.parse(await req.json());
    const income = await prisma.deptIncome.update({ where: { id }, data });
    return ok(income);
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    if (!isLeadership(session)) return fail("forbidden", "Доступно только руководителю", 403);
    const { id } = await ctx.params;
    await prisma.deptIncome.delete({ where: { id } });
    return ok({ ok: true });
  });
}
