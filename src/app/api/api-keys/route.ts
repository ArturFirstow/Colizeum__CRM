import { NextRequest } from "next/server";
import { z } from "zod";
import { withSession, ok, fail } from "@/lib/api";
import { issueApiKey, listApiKeys, revokeApiKey, API_SCOPES } from "@/lib/services/api-keys";
import { writeAudit, clientIp } from "@/lib/audit";

// Управление служебными ключами (требование 9.2). Только администратор:
// ключ открывает данные целому стороннему сервису, это не рядовая настройка.

function guard(role: string) {
  return role === "Owner";
}

export async function GET() {
  return withSession(async (session) => {
    if (!guard(session.role)) return fail("forbidden", "Ключами управляет администратор", 403);
    return ok({ keys: await listApiKeys() });
  });
}

const issueSchema = z.object({
  name: z.string().min(2, "Напишите, для кого ключ"),
  scopes: z.array(z.enum(API_SCOPES)).min(1, "Отметьте хотя бы один раздел"),
  // Бессрочных ключей не бывает: забытый вечный ключ — это дверь, про которую
  // все забыли, а она открыта.
  days: z.number().int().min(1).max(730),
  note: z.string().optional(),
});

export async function POST(req: NextRequest) {
  return withSession(async (session) => {
    if (!guard(session.role)) return fail("forbidden", "Ключами управляет администратор", 403);
    const data = issueSchema.parse(await req.json());

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + data.days);

    const issued = await issueApiKey({
      name: data.name,
      scopes: data.scopes,
      expiresAt,
      note: data.note ?? null,
      createdById: session.userId,
    });

    writeAudit({
      action: "apikey.issue",
      userId: session.userId,
      userName: session.name,
      entityType: "api",
      entityId: issued.prefix,
      changedFields: [data.name, `разделов: ${data.scopes.length}`, `до ${expiresAt.toLocaleDateString("ru-RU")}`],
      ip: clientIp(req),
    });

    // Полное значение возвращается ОДИН раз — дальше в базе только отпечаток.
    return ok({ key: issued.key, prefix: issued.prefix, keys: await listApiKeys() });
  });
}

const revokeSchema = z.object({ id: z.string().min(1) });

export async function DELETE(req: NextRequest) {
  return withSession(async (session) => {
    if (!guard(session.role)) return fail("forbidden", "Ключами управляет администратор", 403);
    const { id } = revokeSchema.parse(await req.json());
    await revokeApiKey(id);
    writeAudit({
      action: "apikey.revoke",
      userId: session.userId,
      userName: session.name,
      entityType: "api",
      entityId: id,
      ip: clientIp(req),
    });
    return ok({ keys: await listApiKeys() });
  });
}
