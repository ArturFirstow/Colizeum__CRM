import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok, fail } from "@/lib/api";
import { notifyUser } from "@/lib/services/notify";

type Ctx = { params: Promise<{ id: string }> };

// Возврат дел: клиенты встают обратно к прежнему владельцу.
export async function POST(_req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    const { id } = await ctx.params;
    const handover = await prisma.handover.findUnique({ where: { id }, include: { items: true } });
    if (!handover) return fail("not_found", "Передача не найдена", 404);
    if (handover.status !== "Активна") return fail("bad_request", "Эта передача уже завершена", 400);
    // Вернуть может тот, кто передал, тот, кто принял, или руководитель.
    if (handover.fromUserId !== session.userId && handover.toUserId !== session.userId && session.role === "Manager") {
      return fail("forbidden", "Вернуть дела может участник передачи или руководитель", 403);
    }

    for (const item of handover.items) {
      await prisma.advertiser.update({
        where: { id: item.advertiserId },
        data: { ownerId: item.previousOwnerId },
      });
    }

    const updated = await prisma.handover.update({
      where: { id },
      data: { status: "Завершена", returnedAt: new Date() },
    });

    await notifyUser(
      handover.fromUserId,
      `🔄 <b>Клиенты вернулись к вам</b>\n\nПередача завершена, ${handover.items.length} клиентов снова в вашем кабинете.`,
    );

    return ok(updated);
  });
}
