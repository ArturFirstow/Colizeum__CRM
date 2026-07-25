import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok, fail } from "@/lib/api";
import { canSeeTournaments } from "@/lib/scope";
import { contractorCreateSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  return withSession(async (session) => {
    if (!canSeeTournaments(session)) return fail("forbidden", "Доступно только турнирному направлению", 403);
    const data = contractorCreateSchema.parse(await req.json());
    const contractor = await prisma.tournamentContractor.create({
      data: {
        name: data.name,
        brand: data.brand,
        contactPerson: data.contactPerson,
        contact: data.contact,
        status: data.status ?? "Лид",
        notes: data.notes,
        ownerId: session.userId,
      },
    });
    return ok(contractor, { status: 201 });
  });
}
