import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok, fail } from "@/lib/api";
import { canSeeTournaments } from "@/lib/scope";
import { contractorUpdateSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    if (!canSeeTournaments(session)) return fail("forbidden", "Нет доступа", 403);
    const { id } = await ctx.params;
    const data = contractorUpdateSchema.parse(await req.json());
    const contractor = await prisma.tournamentContractor.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.brand !== undefined ? { brand: data.brand } : {}),
        ...(data.contactPerson !== undefined ? { contactPerson: data.contactPerson } : {}),
        ...(data.contact !== undefined ? { contact: data.contact } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
      },
    });
    return ok(contractor);
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    if (!canSeeTournaments(session)) return fail("forbidden", "Нет доступа", 403);
    const { id } = await ctx.params;
    await prisma.tournamentContractor.delete({ where: { id } });
    return ok({ ok: true });
  });
}
