import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok, fail } from "@/lib/api";
import { canSeeTournaments } from "@/lib/scope";
import { budgetLineCreateSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

// Добавить строку сметы к турниру.
export async function POST(req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    if (!canSeeTournaments(session)) return fail("forbidden", "Нет доступа", 403);
    const { id } = await ctx.params;
    const data = budgetLineCreateSchema.parse(await req.json());
    const line = await prisma.tournamentBudgetLine.create({
      data: {
        tournamentId: id,
        category: data.category,
        title: data.title,
        amountPlanned: data.amountPlanned ?? 0,
        amountActual: data.amountActual,
        notes: data.notes,
        sort: data.sort ?? 0,
      },
    });
    return ok(line, { status: 201 });
  });
}
