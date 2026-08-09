import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok, fail } from "@/lib/api";
import { handoverCreateSchema } from "@/lib/validation";
import { buildHandoverSummary } from "@/lib/services/handover";
import { notifyUser } from "@/lib/services/notify";

// Передача дел: клиенты переходят замещающему вместе с саммари.
export async function POST(req: NextRequest) {
  return withSession(async (session) => {
    const data = handoverCreateSchema.parse(await req.json());

    if (data.toUserId === session.userId) {
      return fail("bad_request", "Нельзя передать дела самому себе", 400);
    }
    const to = await prisma.user.findUnique({ where: { id: data.toUserId }, select: { id: true, name: true } });
    if (!to) return fail("not_found", "Сотрудник не найден", 404);

    // Передавать можно только своих клиентов — чужие в выборку не попадают.
    const advertisers = await prisma.advertiser.findMany({
      where: { id: { in: data.advertiserIds }, ownerId: session.userId },
      select: { id: true, ownerId: true, nameRu: true },
    });
    if (advertisers.length === 0) return fail("bad_request", "Среди выбранных нет ваших клиентов", 400);

    // Саммари: либо отредактированное сотрудником, либо собираем заново.
    const summary = data.summary ?? (await buildHandoverSummary(advertisers.map((a) => a.id)));

    const handover = await prisma.handover.create({
      data: {
        fromUserId: session.userId,
        toUserId: to.id,
        reason: data.reason ?? null,
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
        note: data.note ?? null,
        summary,
        items: {
          create: advertisers.map((a) => ({ advertiserId: a.id, previousOwnerId: a.ownerId })),
        },
      },
      include: { items: true },
    });

    // Сам перенос: клиенты появляются в кабинете замещающего.
    await prisma.advertiser.updateMany({
      where: { id: { in: advertisers.map((a) => a.id) } },
      data: { ownerId: to.id },
    });

    await notifyUser(
      to.id,
      [
        "🔄 <b>Вам передали клиентов</b>",
        "",
        `От: ${session.name}`,
        `Клиенты: ${advertisers.map((a) => a.nameRu).join(", ")}`,
        data.endsAt ? `До: ${new Date(data.endsAt).toLocaleDateString("ru-RU")}` : "",
        data.note ? `\n${data.note}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );

    return ok(handover, { status: 201 });
  });
}
