import { NextRequest } from "next/server";
import { withSession, ok, fail } from "@/lib/api";
import { retentionStatus, sweepRetention } from "@/lib/services/retention";
import { writeAudit, clientIp } from "@/lib/audit";
import { canSeeCompliance } from "@/lib/scope";
import { z } from "zod";

// Сроки хранения (требование 4.7): таблица сроков с текущими цифрами и уборка
// просроченного. Доступ — те же, кто отвечает за ПДн.

export async function GET() {
  return withSession(async (session) => {
    if (!canSeeCompliance(session)) {
      return fail("forbidden", "Раздел доступен администратору, руководителю и безопасности", 403);
    }
    return ok({ rules: await retentionStatus() });
  });
}

const schema = z.object({
  ruleId: z.string().min(1).optional(),
  /** true — запустить и по несогласованным срокам (с предупреждением на экране). */
  includeUnconfirmed: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  return withSession(async (session) => {
    if (!canSeeCompliance(session)) {
      return fail("forbidden", "Раздел доступен администратору, руководителю и безопасности", 403);
    }
    const { ruleId, includeUnconfirmed } = schema.parse(await req.json());
    const results = await sweepRetention({
      ruleId,
      onlyConfirmed: !includeUnconfirmed,
    });

    const total = results.reduce((s, r) => s + r.done, 0);
    writeAudit({
      action: "retention.sweep",
      userId: session.userId,
      userName: session.name,
      entityType: "security",
      entityId: ruleId ?? "все правила",
      changedFields: results.filter((r) => r.done > 0).map((r) => `${r.title}: ${r.done}`),
      ip: clientIp(req),
    });
    return ok({ results, total, rules: await retentionStatus() });
  });
}
