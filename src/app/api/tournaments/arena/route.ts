import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok, fail } from "@/lib/api";
import { canSeeTournaments } from "@/lib/scope";
import { arenaBookingCreateSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  return withSession(async (session) => {
    if (!canSeeTournaments(session)) return fail("forbidden", "Доступно только турнирному направлению", 403);
    const data = arenaBookingCreateSchema.parse(await req.json());
    const booking = await prisma.arenaBooking.create({
      data: {
        tournamentId: data.tournamentId || undefined,
        contractorId: data.contractorId || undefined,
        clientLabel: data.clientLabel,
        zone: data.zone || "Вся арена",
        timeSlot: data.timeSlot,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        status: data.status ?? "Ожидание",
        notes: data.notes,
      },
    });
    return ok(booking, { status: 201 });
  });
}
