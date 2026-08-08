import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok } from "@/lib/api";
import { dealCreateSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  return withSession(async (session) => {
    const { launchDate, nextStepDate, ...data } = dealCreateSchema.parse(await req.json());
    const deal = await prisma.deal.create({
      data: {
        ...data,
        // Указали причину при создании — сразу поднимаем флажок блокера.
        ...(data.blocker && data.blockerActive === undefined ? { blockerActive: true } : {}),
        launchDate: launchDate ? new Date(launchDate) : undefined,
        nextStepDate: nextStepDate ? new Date(nextStepDate) : undefined,
        ownerId: data.ownerId || session.userId,
      },
    });
    return ok(deal, { status: 201 });
  });
}
