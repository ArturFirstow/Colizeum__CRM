import { NextRequest } from "next/server";
import { withSession, ok, fail } from "@/lib/api";
import { findPersonData, erasePersonData } from "@/lib/services/person-data";
import { writeAudit, clientIp } from "@/lib/audit";
import { canSeePrivacyTools } from "@/lib/scope";
import { z } from "zod";

// Поиск данных человека по всем разделам (требования 4.7 и 5.8).
// Доступ — только администратор: это обязанность оператора, не рядовая задача.
export async function GET(req: NextRequest) {
  return withSession(async (session) => {
    if (!canSeePrivacyTools(session)) {
      return fail("forbidden", "Раздел доступен администратору и ответственному за безопасность", 403);
    }
    const q = req.nextUrl.searchParams.get("q") ?? "";
    const result = await findPersonData(q);

    writeAudit({
      action: "privacy.search",
      userId: session.userId,
      userName: session.name,
      changedFields: [`найдено записей: ${result.total}`],
      ip: clientIp(req),
    });
    return ok(result);
  });
}

const eraseSchema = z.object({
  items: z.array(z.object({ kind: z.string().min(1), id: z.string().min(1) })).min(1),
  // Под запись в журнал: по чьему обращению удаляем.
  reason: z.string().trim().min(1, "Укажите, по чьему обращению удаляем"),
});

export async function POST(req: NextRequest) {
  return withSession(async (session) => {
    if (!canSeePrivacyTools(session)) {
      return fail("forbidden", "Удалять данные по запросу может администратор или безопасность", 403);
    }
    const { items, reason } = eraseSchema.parse(await req.json());
    const res = await erasePersonData(items);

    writeAudit({
      action: "privacy.erase",
      userId: session.userId,
      userName: session.name,
      changedFields: [`удалено: ${res.deleted}`, `обезличено: ${res.anonymized}`, `основание: ${reason}`],
      ip: clientIp(req),
    });
    return ok(res);
  });
}
