import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok, fail } from "@/lib/api";
import { z } from "zod";

const schema = z.object({ userId: z.string().min(1) });

// Открыть личку с сотрудником: найти существующий диалог 1-на-1 или создать.
export async function POST(req: NextRequest) {
  return withSession(async (session) => {
    const { userId } = schema.parse(await req.json());
    if (userId === session.userId) return fail("bad_request", "Нельзя писать самому себе", 400);

    const other = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true } });
    if (!other) return fail("not_found", "Сотрудник не найден", 404);

    const existing = await prisma.channel.findFirst({
      where: {
        isDm: true,
        AND: [{ members: { some: { userId: session.userId } } }, { members: { some: { userId: userId } } }],
      },
    });
    if (existing) return ok({ id: existing.id, name: other.name });

    const channel = await prisma.channel.create({
      data: {
        name: "Личка",
        isDm: true,
        createdById: session.userId,
        members: { create: [{ userId: session.userId }, { userId }] },
      },
    });
    return ok({ id: channel.id, name: other.name }, { status: 201 });
  });
}
