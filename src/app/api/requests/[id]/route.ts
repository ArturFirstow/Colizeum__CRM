import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok } from "@/lib/api";
import { guardRequestRecord } from "@/lib/guard";
import { writeAudit, clientIp } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

// Удаление сохранённого запроса: ошиблись кнопкой — запись убирается.
export async function DELETE(req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    const { id } = await ctx.params;
    await guardRequestRecord(session, id);
    await prisma.requestRecord.delete({ where: { id } });
    writeAudit({
      action: "request.delete",
      userId: session.userId,
      userName: session.name,
      entityType: "request",
      entityId: id,
      ip: clientIp(req),
    });
    return ok({ ok: true });
  });
}
