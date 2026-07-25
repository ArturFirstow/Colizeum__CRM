import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok, fail } from "@/lib/api";
import { canSeeTournaments } from "@/lib/scope";
import { arenaBookingUpdateSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    if (!canSeeTournaments(session)) return fail("forbidden", "Нет доступа", 403);
    const { id } = await ctx.params;
    const data = arenaBookingUpdateSchema.parse(await req.json());
    const booking = await prisma.arenaBooking.update({
      where: { id },
      data: {
        ...(data.tournamentId !== undefined ? { tournamentId: data.tournamentId || null } : {}),
        ...(data.contractorId !== undefined ? { contractorId: data.contractorId || null } : {}),
        ...(data.clientLabel !== undefined ? { clientLabel: data.clientLabel } : {}),
        ...(data.zone !== undefined ? { zone: data.zone || "Вся арена" } : {}),
        ...(data.timeSlot !== undefined ? { timeSlot: data.timeSlot } : {}),
        ...(data.startDate ? { startDate: new Date(data.startDate) } : {}),
        ...(data.endDate ? { endDate: new Date(data.endDate) } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
      },
    });
    return ok(booking);
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    if (!canSeeTournaments(session)) return fail("forbidden", "Нет доступа", 403);
    const { id } = await ctx.params;
    await prisma.arenaBooking.delete({ where: { id } });
    return ok({ ok: true });
  });
}
