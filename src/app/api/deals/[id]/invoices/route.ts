import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok } from "@/lib/api";
import { invoiceCreateSchema } from "@/lib/validation";
import { guardDeal } from "@/lib/guard";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    const { id } = await ctx.params;
    await guardDeal(session, id);
    const data = invoiceCreateSchema.parse(await req.json());
    const invoice = await prisma.invoice.create({
      data: { ...data, dealId: id, issuedAt: new Date() },
    });
    return ok(invoice, { status: 201 });
  });
}
