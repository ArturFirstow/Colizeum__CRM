import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok } from "@/lib/api";
import { ordStandaloneCreateSchema } from "@/lib/validation";

// Создать запись ОРД/ЕРИД (со страницы «ОРД»).
export async function POST(req: NextRequest) {
  return withSession(async () => {
    const data = ordStandaloneCreateSchema.parse(await req.json());
    const ord = await prisma.ordMarking.create({ data: { ...data, markedAt: new Date() } });
    return ok(ord, { status: 201 });
  });
}
