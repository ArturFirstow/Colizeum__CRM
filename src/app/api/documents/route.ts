import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok } from "@/lib/api";
import { documentCreateSchema } from "@/lib/validation";
import { guardAdvertiser, guardDeal } from "@/lib/guard";
import { PublicError } from "@/lib/errors";

// Создать логический документ (без файла — файл грузится версией отдельно).
//
// ⚠️ Проверки владельца здесь НЕ БЫЛО: зная идентификатор чужого клиента,
// можно было завести документ в его папке. Тот же класс дыры, что ловили в
// маркировке (И-9), в размещениях и в плановых платежах — списки отдаются по
// области видимости, и это создаёт ложное чувство защищённости.
export async function POST(req: NextRequest) {
  return withSession(async (session) => {
    const data = documentCreateSchema.parse(await req.json());
    await guardAdvertiser(session, data.advertiserId);
    if (data.dealId) {
      const deal = await guardDeal(session, data.dealId);
      // Документ по сделке одного клиента не должен лежать в папке другого.
      if (deal.advertiserId !== data.advertiserId) {
        throw new PublicError("Сделка принадлежит другому клиенту", { status: 400 });
      }
    }
    const document = await prisma.document.create({ data });
    return ok(document, { status: 201 });
  });
}
