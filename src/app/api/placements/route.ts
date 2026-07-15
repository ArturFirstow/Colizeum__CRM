import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok } from "@/lib/api";
import { placementCreateSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  return withSession(async () => {
    const data = placementCreateSchema.parse(await req.json());
    const placement = await prisma.placement.create({
      data: {
        advertiserId: data.advertiserId || undefined,
        brandLabel: data.brandLabel || undefined,
        dealId: data.dealId || undefined,
        slot: data.slot,
        responsible: data.responsible || undefined,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        status: data.status,
        notes: data.notes || undefined,
      },
    });
    return ok(placement, { status: 201 });
  });
}
