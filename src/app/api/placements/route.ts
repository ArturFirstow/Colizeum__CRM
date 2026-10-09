import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok } from "@/lib/api";
import { placementCreateSchema } from "@/lib/validation";
import { guardAdvertiser, guardDeal } from "@/lib/guard";
import { PublicError } from "@/lib/errors";

export async function POST(req: NextRequest) {
  return withSession(async (session) => {
    const data = placementCreateSchema.parse(await req.json());

    // Календарь размещений общий для отдела, но привязать бронь можно только
    // к своему клиенту и своей сделке — иначе чужая запись оказалась бы
    // связанной с чужой сделкой по прямому запросу.
    if (data.advertiserId) await guardAdvertiser(session, data.advertiserId);
    if (data.dealId) {
      const deal = await guardDeal(session, data.dealId);
      // Бронь не может ссылаться на сделку одного клиента и карточку другого.
      if (data.advertiserId && deal.advertiserId !== data.advertiserId) {
        throw new PublicError("Сделка принадлежит другому клиенту", { status: 400 });
      }
    }

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
