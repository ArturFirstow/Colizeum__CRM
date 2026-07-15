import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withSession, ok } from "@/lib/api";

const schema = z.object({
  number: z.string().trim().optional(),
  payer: z.string().trim().optional(),
  payee: z.string().trim().optional(),
  purpose: z.string().trim().optional(),
  amount: z.number().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  return withSession(async () => {
    const { id } = await ctx.params;
    const data = schema.parse(await req.json());
    const payment = await prisma.payment.create({
      data: { ...data, invoiceId: id, paidAt: new Date() },
    });
    return ok(payment, { status: 201 });
  });
}
