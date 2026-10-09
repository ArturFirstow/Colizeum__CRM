import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok } from "@/lib/api";
import { requestRecordCreateSchema } from "@/lib/validation";
import { guardAdvertiser, guardDeal } from "@/lib/guard";
import { writeAudit, clientIp } from "@/lib/audit";
import { PublicError } from "@/lib/errors";

// ─────────────────────────────────────────────────────────────────────────────
// Сохранение запроса из конструктора в историю клиента (просьба коллег И-10).
//
// Конструкторы «Запрос юристу» и «Запрос на размещение» собирают готовый текст,
// который человек копирует в письмо. До этого текст нигде не оставался: через
// месяц уже не вспомнить, какие форматы и суммы уходили юристу и что именно
// просили разместить. Теперь нажатием сохраняется ровно отправленная версия —
// она встаёт в хронологию клиента и видна в карточке сделки.
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  return withSession(async (session) => {
    const data = requestRecordCreateSchema.parse(await req.json());

    await guardAdvertiser(session, data.advertiserId);
    if (data.dealId) {
      const deal = await guardDeal(session, data.dealId);
      if (deal.advertiserId !== data.advertiserId) {
        throw new PublicError("Сделка принадлежит другому клиенту", { status: 400 });
      }
    }

    const created = await prisma.requestRecord.create({
      data: {
        advertiserId: data.advertiserId,
        dealId: data.dealId || undefined,
        kind: data.kind,
        formats: data.formats || undefined,
        body: data.body,
        authorId: session.userId,
      },
      select: { id: true, createdAt: true },
    });

    // В журнал — только вид запроса: сам текст содержит реквизиты клиента,
    // а в журнале значений полей мы не храним.
    writeAudit({
      action: "request.create",
      userId: session.userId,
      userName: session.name,
      entityType: "request",
      entityId: created.id,
      changedFields: [data.kind],
      ip: clientIp(req),
    });

    return ok(created, { status: 201 });
  });
}
