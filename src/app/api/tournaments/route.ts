import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok, fail } from "@/lib/api";
import { canSeeTournaments } from "@/lib/scope";
import { tournamentCreateSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  return withSession(async (session) => {
    if (!canSeeTournaments(session)) return fail("forbidden", "Доступно только турнирному направлению", 403);
    const data = tournamentCreateSchema.parse(await req.json());
    const tournament = await prisma.tournament.create({
      data: {
        title: data.title,
        contractorId: data.contractorId || undefined,
        clientLabel: data.clientLabel,
        discipline: data.discipline,
        format: data.format,
        arena: data.arena ?? "Colizeum Шелепиха",
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        status: data.status ?? "Планируется",
        budgetNote: data.budgetNote,
        ownerId: session.userId,
      },
    });
    return ok(tournament, { status: 201 });
  });
}
