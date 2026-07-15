import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok } from "@/lib/api";
import { promoStandaloneCreateSchema } from "@/lib/validation";

// Создать партию промокодов по рекламодателю (со страницы «Промокоды»).
export async function POST(req: NextRequest) {
  return withSession(async () => {
    const data = promoStandaloneCreateSchema.parse(await req.json());
    const promo = await prisma.promoBatch.create({ data });
    return ok(promo, { status: 201 });
  });
}
