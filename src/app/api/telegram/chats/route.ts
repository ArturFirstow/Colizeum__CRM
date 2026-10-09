import { NextRequest } from "next/server";
import dns from "node:dns";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withSession, ok, fail } from "@/lib/api";
import { writeAudit, clientIp } from "@/lib/audit";

// ─────────────────────────────────────────────────────────────────────────────
// Кто написал боту — и привязка чата к сотруднику в один клик (просьба И-11).
//
// Почему это понадобилось. Чтобы сотрудник получал уведомления, нужны ДВА
// действия: он пишет боту (иначе Telegram не разрешает боту писать первым —
// защита от спама) и кто-то связывает его чат с учётной записью в сервисе.
// Вторая половина делалась командой на сервере через SSH, то есть упиралась в
// одного человека с доступом. Поэтому уведомления так и остались настроенными
// только у админа.
//
// Теперь список написавших виден в «Команде», и привязка — одно нажатие.
// ─────────────────────────────────────────────────────────────────────────────

// На серверах без IPv6 Node сначала пробует IPv6-адрес Telegram и ждёт
// таймаута — запрос падает с ETIMEDOUT на ровном месте.
dns.setDefaultResultOrder("ipv4first");

type TgChat = { id: number; first_name?: string; last_name?: string; username?: string };
type TgUpdate = { message?: { chat?: TgChat }; my_chat_member?: { chat?: TgChat } };

function guard(role: string) {
  return role === "Owner";
}

export async function GET() {
  return withSession(async (session) => {
    if (!guard(session.role)) return fail("forbidden", "Доступно администратору", 403);

    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      return ok({ configured: false, chats: [], hint: "Бот не настроен — см. docs/TELEGRAM.md" });
    }

    let chats: { chatId: string; name: string; username: string | null }[] = [];
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`, {
        signal: AbortSignal.timeout(12_000),
        cache: "no-store",
      });
      const data = (await res.json()) as { ok: boolean; result?: TgUpdate[]; description?: string };
      if (!data.ok) {
        return ok({ configured: true, chats: [], error: data.description ?? "Telegram ответил ошибкой" });
      }
      // Один человек мог написать несколько раз — оставляем по одному на чат.
      const byId = new Map<number, TgChat>();
      for (const u of data.result ?? []) {
        const c = u.message?.chat ?? u.my_chat_member?.chat;
        if (c?.id) byId.set(c.id, c);
      }
      chats = [...byId.values()].map((c) => ({
        chatId: String(c.id),
        name: [c.first_name, c.last_name].filter(Boolean).join(" ") || c.username || String(c.id),
        username: c.username ?? null,
      }));
    } catch {
      return ok({
        configured: true,
        chats: [],
        error: "Не удалось связаться с Telegram. Из России он доступен не всегда — попробуйте позже.",
      });
    }

    // Кого уже привязали — чтобы не предлагать повторно.
    const taken = await prisma.user.findMany({
      where: { telegramChatId: { not: null } },
      select: { name: true, telegramChatId: true },
    });
    return ok({ configured: true, chats, taken });
  });
}

const bindSchema = z.object({
  userId: z.string().min(1),
  chatId: z.string().min(1).nullable(),
});

export async function POST(req: NextRequest) {
  return withSession(async (session) => {
    if (!guard(session.role)) return fail("forbidden", "Доступно администратору", 403);
    const { userId, chatId } = bindSchema.parse(await req.json());

    const user = await prisma.user.update({
      where: { id: userId },
      data: { telegramChatId: chatId },
      select: { id: true, name: true, telegramChatId: true },
    });

    writeAudit({
      action: "user.update",
      userId: session.userId,
      userName: session.name,
      entityType: "user",
      entityId: userId,
      changedFields: [chatId ? "telegramChatId (привязан)" : "telegramChatId (снят)"],
      ip: clientIp(req),
    });
    return ok(user);
  });
}
