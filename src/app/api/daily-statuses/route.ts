import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok } from "@/lib/api";
import { dailyStatusCreateSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  return withSession(async (session) => {
    const data = dailyStatusCreateSchema.parse(await req.json());
    const status = await prisma.dailyStatus.create({
      data: {
        advertiserId: data.advertiserId,
        dealId: data.dealId || undefined,
        text: data.text,
        authorId: session.userId,
      },
    });
    return ok(status, { status: 201 });
  });
}
