import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok } from "@/lib/api";
import { plannedPaymentUpdateSchema } from "@/lib/validation";
import { guardPlannedPayment } from "@/lib/guard";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    const { id } = await ctx.params;
    await guardPlannedPayment(session, id);
    const data = plannedPaymentUpdateSchema.parse(await req.json());
    const payment = await prisma.plannedPayment.update({
      where: { id },
      data: {
        ...data,
        paidAt: data.status === "Оплачено" ? new Date() : data.status ? null : undefined,
      },
    });
    return ok(payment);
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    const { id } = await ctx.params;
    await guardPlannedPayment(session, id);
    await prisma.plannedPayment.delete({ where: { id } });
    return ok({ ok: true });
  });
}
