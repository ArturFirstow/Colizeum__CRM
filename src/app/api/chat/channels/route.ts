import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok } from "@/lib/api";
import { channelCreateSchema } from "@/lib/validation";

// Создать канал (доступно всем сотрудникам).
export async function POST(req: NextRequest) {
  return withSession(async (session) => {
    const data = channelCreateSchema.parse(await req.json());
    const channel = await prisma.channel.create({
      data: { name: data.name, description: data.description, createdById: session.userId },
    });
    return ok(channel, { status: 201 });
  });
}
