import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok, fail } from "@/lib/api";
import { dealUpdateSchema } from "@/lib/validation";
import { checkStageTransition, isValidStage } from "@/lib/services/deal-stage";
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
  return withSession(async () => {
    const { id } = await ctx.params;
    const { confirm, ...data } = dealUpdateSchema.parse(await req.json());

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

    const deal = await prisma.deal.update({ where: { id }, data });
    return ok(deal);
  });
}
