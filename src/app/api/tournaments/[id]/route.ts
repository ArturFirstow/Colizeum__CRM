import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok, fail } from "@/lib/api";
import { canSeeTournaments } from "@/lib/scope";
import { tournamentUpdateSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    if (!canSeeTournaments(session)) return fail("forbidden", "Нет доступа", 403);
    const { id } = await ctx.params;
    const data = tournamentUpdateSchema.parse(await req.json());
    const tournament = await prisma.tournament.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.contractorId !== undefined ? { contractorId: data.contractorId || null } : {}),
        ...(data.clientLabel !== undefined ? { clientLabel: data.clientLabel } : {}),
        ...(data.discipline !== undefined ? { discipline: data.discipline } : {}),
        ...(data.format !== undefined ? { format: data.format } : {}),
        ...(data.arena !== undefined ? { arena: data.arena } : {}),
        ...(data.startDate !== undefined ? { startDate: data.startDate ? new Date(data.startDate) : null } : {}),
        ...(data.endDate !== undefined ? { endDate: data.endDate ? new Date(data.endDate) : null } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.budgetNote !== undefined ? { budgetNote: data.budgetNote } : {}),
      },
    });
    return ok(tournament);
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    if (!canSeeTournaments(session)) return fail("forbidden", "Нет доступа", 403);
    const { id } = await ctx.params;
    await prisma.tournament.delete({ where: { id } });
    return ok({ ok: true });
  });
}
