import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok, fail } from "@/lib/api";
import { canSeeTournaments } from "@/lib/scope";
import { budgetLineUpdateSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ lineId: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    if (!canSeeTournaments(session)) return fail("forbidden", "Нет доступа", 403);
    const { lineId } = await ctx.params;
    const data = budgetLineUpdateSchema.parse(await req.json());
    const line = await prisma.tournamentBudgetLine.update({
      where: { id: lineId },
      data: {
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.amountPlanned !== undefined ? { amountPlanned: data.amountPlanned } : {}),
        ...(data.amountActual !== undefined ? { amountActual: data.amountActual } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.sort !== undefined ? { sort: data.sort } : {}),
      },
    });
    return ok(line);
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    if (!canSeeTournaments(session)) return fail("forbidden", "Нет доступа", 403);
    const { lineId } = await ctx.params;
    await prisma.tournamentBudgetLine.delete({ where: { id: lineId } });
    return ok({ ok: true });
  });
}
