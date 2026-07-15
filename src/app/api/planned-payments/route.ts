import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok } from "@/lib/api";
import { plannedPaymentCreateSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  return withSession(async () => {
    const data = plannedPaymentCreateSchema.parse(await req.json());
    const payment = await prisma.plannedPayment.create({
      data: { ...data, paidAt: data.status === "Оплачено" ? new Date() : undefined },
    });
    return ok(payment, { status: 201 });
  });
}
