import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok, fail } from "@/lib/api";
import { getStorage, sanitizeFileName } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

// Лента сообщений канала (от старых к новым).
export async function GET(_req: NextRequest, ctx: Ctx) {
  return withSession(async () => {
    const { id } = await ctx.params;
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
    const channel = await prisma.channel.findUnique({ where: { id } });
    if (!channel) return fail("not_found", "Канал не найден", 404);

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

    return ok({ id: message.id }, { status: 201 });
  });
}
