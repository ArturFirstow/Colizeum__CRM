import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok } from "@/lib/api";
import { plannedPaymentCreateSchema } from "@/lib/validation";
import { guardAdvertiser, guardDeal } from "@/lib/guard";
import { PublicError } from "@/lib/errors";

// Плановый платёж — разбивка бюджета сделки по месяцам.
//
// ⚠️ Проверка владельца стояла на правке и удалении (guardPlannedPayment), а
// на СОЗДАНИИ — нет: зная идентификатор чужого клиента, можно было завести
// платёж в его календарь. Та же дыра, что ловили в маркировке и размещениях
// (пункт коллег И-9): права проверяются на сервере, а не тем, что в списке
// чужого не видно.
export async function POST(req: NextRequest) {
  return withSession(async (session) => {
    const data = plannedPaymentCreateSchema.parse(await req.json());
    await guardAdvertiser(session, data.advertiserId);
    if (data.dealId) {
      const deal = await guardDeal(session, data.dealId);
      // Платёж по сделке одного клиента не должен попадать в строку другого:
      // календарь строится по клиентам, и цифры разошлись бы молча.
      if (deal.advertiserId !== data.advertiserId) {
        throw new PublicError("Сделка принадлежит другому клиенту", { status: 400 });
      }
    }
    const payment = await prisma.plannedPayment.create({
      data: { ...data, paidAt: data.status === "Оплачено" ? new Date() : undefined },
    });
    return ok(payment, { status: 201 });
  });
}
