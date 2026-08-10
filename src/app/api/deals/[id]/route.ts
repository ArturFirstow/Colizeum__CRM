import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok, fail } from "@/lib/api";
import { dealUpdateSchema } from "@/lib/validation";
import { checkStageTransition, isValidStage } from "@/lib/services/deal-stage";
import { notifyBlockerRaised } from "@/lib/services/notify";
import type { DealStage } from "@/lib/enums";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  return withSession(async () => {
    const { id } = await ctx.params;
    const deal = await prisma.deal.findUnique({
      where: { id },
      include: { advertiser: true, owner: true, assignee: true },
    });
    if (!deal) return fail("not_found", "Сделка не найдена", 404);
    return ok(deal);
  });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    const { id } = await ctx.params;
    const { confirm, launchDate, nextStepDate, ...data } = dealUpdateSchema.parse(await req.json());

    const existing = await prisma.deal.findUnique({ where: { id } });
    if (!existing) return fail("not_found", "Сделка не найдена", 404);

    // Смена стадии → проверка инвариантов (блупринт 7.3).
    if (data.stage && data.stage !== existing.stage) {
      if (!isValidStage(data.stage)) return fail("bad_stage", "Неизвестная стадия", 400);
      const { warnings } = await checkStageTransition(existing, data.stage as DealStage);
      if (warnings.length > 0 && !confirm) {
        // 409: нужно подтверждение пользователя.
        return fail("stage_warnings", "Есть предупреждения по переходу стадии", 409, {
          warnings,
        });
      }
    }

    const deal = await prisma.deal.update({
      where: { id },
      data: {
        ...data,
        // Стёрли текст блокера — значит блокера нет: снимаем и флажок.
        ...(data.blocker === null ? { blockerActive: false } : {}),
        ...(launchDate !== undefined ? { launchDate: launchDate ? new Date(launchDate) : null } : {}),
        ...(nextStepDate !== undefined ? { nextStepDate: nextStepDate ? new Date(nextStepDate) : null } : {}),
      },
    });
    // Блокер только что подняли — руководитель узнаёт сразу.
    if (deal.blockerActive && !existing.blockerActive) {
      const advertiser = await prisma.advertiser.findUnique({
        where: { id: deal.advertiserId },
        select: { nameRu: true },
      });
      await notifyBlockerRaised({
        dealId: deal.id,
        dealTitle: deal.title,
        clientName: advertiser?.nameRu ?? "клиент",
        reason: deal.blocker,
        byName: session.name,
      });
    }

    return ok(deal);
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return withSession(async () => {
    const { id } = await ctx.params;
    await prisma.deal.delete({ where: { id } });
    return ok({ ok: true });
  });
}
