import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok } from "@/lib/api";
import { dealCreateSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  return withSession(async (session) => {
    const data = dealCreateSchema.parse(await req.json());
    const deal = await prisma.deal.create({
      data: {
        ...data,
        ownerId: data.ownerId || session.userId,
      },
    });
    return ok(deal, { status: 201 });
  });
}
