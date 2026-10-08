import { NextRequest } from "next/server";
import { withSession, ok, fail } from "@/lib/api";
import { recordConsents, pendingConsents } from "@/lib/services/consent";
import { writeAudit, clientIp } from "@/lib/audit";
import { z } from "zod";

// Какие документы человеку ещё предстоит принять.
export async function GET() {
  return withSession(async (session) => ok(await pendingConsents(session.userId)));
}

const schema = z.object({ slugs: z.array(z.string().min(1)).min(1) });

// Принятие. Галочку человек ставит сам — заранее она не отмечена (требование 4.2).
export async function POST(req: NextRequest) {
  return withSession(async (session) => {
    const { slugs } = schema.parse(await req.json());
    const ip = clientIp(req);

    const stillPending = await pendingConsents(session.userId);
    const expected = new Set(stillPending.map((d) => d.slug));
    // Принять можно только то, что сервис действительно спрашивал: иначе в
    // журнале оказались бы принятия документов, которых человек не видел.
    const unknown = slugs.filter((s) => !expected.has(s));
    if (unknown.length) return fail("bad_request", "Эти документы сейчас не запрашивались", 400);

    await recordConsents(session.userId, slugs, ip);
    writeAudit({
      action: "consent.accept",
      userId: session.userId,
      userName: session.name,
      entityType: "user",
      entityId: session.userId,
      changedFields: slugs,
      ip,
    });
    return ok({ accepted: slugs.length });
  });
}
