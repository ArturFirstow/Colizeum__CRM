import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok, fail } from "@/lib/api";
import { getStorage, sanitizeFileName } from "@/lib/storage";
import { emitChatMessage } from "@/lib/chat-events";

type Ctx = { params: Promise<{ id: string }> };

// Личку видят только её участники; обычные каналы — все сотрудники.
async function assertAccess(channelId: string, userId: string) {
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel) return { ok: false as const, code: "not_found", message: "Канал не найден", status: 404 };
  if (channel.isDm) {
    const member = await prisma.channelMember.findUnique({ where: { channelId_userId: { channelId, userId } } });
    if (!member) return { ok: false as const, code: "forbidden", message: "Нет доступа к диалогу", status: 403 };
  }
  return { ok: true as const, channel };
}

// Лента сообщений канала (от старых к новым).
export async function GET(_req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    const { id } = await ctx.params;
    const access = await assertAccess(id, session.userId);
    if (!access.ok) return fail(access.code, access.message, access.status);
    const messages = await prisma.chatMessage.findMany({
      where: { channelId: id },
      include: {
        author: { select: { id: true, name: true } },
        attachments: { select: { id: true, fileName: true, sizeBytes: true, contentType: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    return ok(messages);
  });
}

// Отправить сообщение (текст + вложения + привязка к клиенту/сделке).
export async function POST(req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    const { id } = await ctx.params;
    const access = await assertAccess(id, session.userId);
    if (!access.ok) return fail(access.code, access.message, access.status);

    const form = await req.formData();
    const body = String(form.get("body") ?? "").trim();
    const files = form.getAll("files").filter((f): f is File => typeof f !== "string" && !!f);
    if (!body && files.length === 0) return fail("empty", "Пустое сообщение", 400);

    const contextType = String(form.get("contextType") ?? "") || null;
    const contextId = String(form.get("contextId") ?? "") || null;
    const contextLabel = String(form.get("contextLabel") ?? "") || null;

    const message = await prisma.chatMessage.create({
      data: {
        channelId: id,
        authorId: session.userId,
        body: body || "📎 вложение",
        contextType,
        contextId,
        contextLabel,
      },
    });

    const storage = getStorage();
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      if (buffer.length === 0) continue;
      const fileName = file.name || "file";
      const contentType = file.type || "application/octet-stream";
      const storageKey = `chat/${id}/${message.id}/${sanitizeFileName(fileName)}`;
      await storage.put(storageKey, buffer, contentType);
      await prisma.chatAttachment.create({
        data: { messageId: message.id, storageKey, fileName, sizeBytes: buffer.length, contentType },
      });
    }

    emitChatMessage(id); // realtime: разбудить открытые чаты этого канала
    return ok({ id: message.id }, { status: 201 });
  });
}
